import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType, PageBreak } from "docx";
import { ResearchPaper } from "../types";

const normalizeChartData = (data: any[]) => {
  if (!data || !Array.isArray(data)) return [];
  return data.map((d: any) => {
    let name = d.name;
    let value = d.value;
    
    if (name === undefined || value === undefined) {
      const keys = Object.keys(d);
      const nameKey = keys.find(k => typeof d[k] === 'string' || k.toLowerCase().includes('name') || k.toLowerCase().includes('label') || k.toLowerCase() === 'x') || keys[0];
      const valKey = keys.find(k => k !== nameKey && !isNaN(Number(d[k]))) || keys[1] || keys[0];
      
      name = name ?? d[nameKey];
      value = value ?? d[valKey];
    }
    
    return { ...d, name: String(name), value: Number(value) || 0 };
  });
};

const getQuickChartUrl = (viz: any) => {
  const data = normalizeChartData(viz.data);
  const type = viz.type === 'bar' ? 'bar' : viz.type === 'pie' ? 'pie' : 'line';
  
  let datasets;
  if (type === 'pie') {
    datasets = [{
      data: data.map(d => d.value),
    }];
  } else {
    datasets = [{
      label: viz.title || 'Value',
      data: data.map(d => d.value),
      backgroundColor: 'rgba(236, 72, 153, 0.5)',
      borderColor: 'rgba(236, 72, 153, 1)',
      borderWidth: 1
    }];
  }

  const chartConfig = {
    type,
    data: {
      labels: data.map(d => d.name),
      datasets
    },
    options: {
      plugins: {
        legend: { display: type === 'pie' }
      }
    }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=300&bkg=white`;
};

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

const fetchImageAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  return await response.arrayBuffer();
};

const getModelImageBase64 = (term: string, type: string): string => {
  try {
    const container = document.getElementById(`model-canvas-${term.replace(/[^a-zA-Z0-9]/g, '')}`);
    const canvas = container?.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      if (dataUrl && dataUrl.length > 1000) {
        return dataUrl;
      }
    }
  } catch (e) {
    console.error("Could not capture 3D model", e);
  }
  return generateProceduralModelImage(type);
};

const drawProceduralChart = (viz: any): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const data = normalizeChartData(viz.data);
  const type = String(viz.type || 'bar').toLowerCase();
  const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Fill elegant dark background matching the PDF/research theme
  ctx.fillStyle = "#0f172a"; // Slate dark canvas
  ctx.fillRect(0, 0, 600, 300);

  // Draw grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 50; i < 550; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 30);
    ctx.lineTo(i, 250);
    ctx.stroke();
  }
  for (let i = 30; i < 250; i += 40) {
    ctx.beginPath();
    ctx.moveTo(50, i);
    ctx.lineTo(550, i);
    ctx.stroke();
  }

  // Draw title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText(viz.title || "Data Visualization", 50, 25);

  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 45;
  const paddingBottom = 60;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  if (type === 'pie') {
    // Render a high-quality Pie Chart
    const total = data.reduce((sum: number, d: any) => sum + d.value, 0) || 1;
    let startAngle = -Math.PI / 2;
    const cx = 200;
    const cy = 160;
    const radius = 80;

    data.forEach((d: any, idx: number) => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      ctx.fillStyle = colors[idx % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Draw thin border
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    // Draw Legend
    let legendY = paddingTop + 10;
    data.forEach((d: any, idx: number) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(380, legendY, 15, 10);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Arial, sans-serif";
      ctx.textAlign = "left";
      const pct = ((d.value / total) * 100).toFixed(0);
      ctx.fillText(`${d.name}: ${d.value} (${pct}%)`, 405, legendY + 9);
      legendY += 22;
    });
  } else if (type === 'bar') {
    // Bar Chart
    const maxVal = Math.max(...data.map((d: any) => d.value), 1) * 1.1;
    
    // Draw Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
    ctx.stroke();

    const barWidth = (chartWidth / data.length) * 0.6;
    const spacing = (chartWidth / data.length) * 0.4;

    data.forEach((d: any, idx: number) => {
      const valHeight = (d.value / maxVal) * chartHeight;
      const x = paddingLeft + idx * (barWidth + spacing) + spacing / 2;
      const y = canvas.height - paddingBottom - valHeight;

      // Draw Bar with a beautiful vertical gradient
      const barGrad = ctx.createLinearGradient(x, y, x, canvas.height - paddingBottom);
      barGrad.addColorStop(0, "#ec4899");
      barGrad.addColorStop(1, "#be185d");
      ctx.fillStyle = barGrad;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, valHeight, [4, 4, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, valHeight);
      }
      ctx.fill();

      // Label value on top of bar
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d.value), x + barWidth / 2, y - 5);

      // Category label at bottom
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Arial, sans-serif";
      ctx.fillText(d.name, x + barWidth / 2, canvas.height - paddingBottom + 18);
    });
  } else if (type === 'area') {
    // Area Chart
    const maxVal = Math.max(...data.map((d: any) => d.value), 1) * 1.1;

    // Draw Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
    ctx.stroke();

    const xStep = chartWidth / (data.length - 1 || 1);

    // Area Path
    ctx.beginPath();
    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(paddingLeft + (data.length - 1) * xStep, canvas.height - paddingBottom);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, canvas.height - paddingBottom);
    areaGrad.addColorStop(0, "rgba(16, 185, 129, 0.45)");
    areaGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Top Line
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Nodes and labels
    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d.value), x, y - 10);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Arial, sans-serif";
      ctx.fillText(d.name, x, canvas.height - paddingBottom + 18);
    });
  } else if (type === 'radar') {
    // Radar Chart
    const maxVal = Math.max(...data.map((d: any) => d.value), 1) * 1.1;
    const cx = 220;
    const cy = 160;
    const radius = 80;
    const numPoints = data.length;

    // Outer grid rings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let r = 1; r <= 4; r++) {
      const scaleRadius = (r / 4) * radius;
      ctx.beginPath();
      for (let j = 0; j < numPoints; j++) {
        const angle = (j * Math.PI * 2) / numPoints - Math.PI / 2;
        const x = cx + Math.cos(angle) * scaleRadius;
        const y = cy + Math.sin(angle) * scaleRadius;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Spider lines
    ctx.beginPath();
    for (let j = 0; j < numPoints; j++) {
      const angle = (j * Math.PI * 2) / numPoints - Math.PI / 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.stroke();

    // Fill area
    ctx.beginPath();
    data.forEach((d: any, idx: number) => {
      const angle = (idx * Math.PI * 2) / numPoints - Math.PI / 2;
      const valRadius = (d.value / maxVal) * radius;
      const x = cx + Math.cos(angle) * valRadius;
      const y = cy + Math.sin(angle) * valRadius;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(168, 85, 247, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Nodes and outer labels
    data.forEach((d: any, idx: number) => {
      const angle = (idx * Math.PI * 2) / numPoints - Math.PI / 2;
      const valRadius = (d.value / maxVal) * radius;
      const x = cx + Math.cos(angle) * valRadius;
      const y = cy + Math.sin(angle) * valRadius;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const labelDist = radius + 22;
      const lx = cx + Math.cos(angle) * labelDist;
      const ly = cy + Math.sin(angle) * labelDist;

      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px Arial, sans-serif";
      ctx.textAlign = Math.cos(angle) > 0.1 ? "left" : Math.cos(angle) < -0.1 ? "right" : "center";
      ctx.fillText(`${d.name} (${d.value})`, lx, ly + 3);
    });
  } else if (type === 'scatter') {
    // Scatter Plot
    const maxVal = Math.max(...data.map((d: any) => d.value), 1) * 1.1;

    // Draw Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
    ctx.stroke();

    const xStep = chartWidth / (data.length || 1);
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep + xStep / 2;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;

      sumX += idx;
      sumY += d.value;
      sumXY += idx * d.value;
      sumXX += idx * idx;

      // Scatter Dots
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d.value), x, y - 10);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Arial, sans-serif";
      ctx.fillText(d.name, x, canvas.height - paddingBottom + 18);
    });

    // Trendline
    if (data.length > 1) {
      const n = data.length;
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;

      const x1 = paddingLeft + xStep / 2;
      const y1 = canvas.height - paddingBottom - (intercept / maxVal) * chartHeight;
      const x2 = paddingLeft + (n - 1) * xStep + xStep / 2;
      const y2 = canvas.height - paddingBottom - (((slope * (n - 1) + intercept)) / maxVal) * chartHeight;

      ctx.strokeStyle = "rgba(244, 63, 94, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    // Line Chart (default)
    const maxVal = Math.max(...data.map((d: any) => d.value), 1) * 1.1;

    // Draw Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
    ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
    ctx.stroke();

    const xStep = chartWidth / (data.length - 1 || 1);

    // Draw line
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw nodes and labels
    data.forEach((d: any, idx: number) => {
      const x = paddingLeft + idx * xStep;
      const y = canvas.height - paddingBottom - (d.value / maxVal) * chartHeight;

      // Outer glowing ring
      ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Core white node
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Value label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d.value), x, y - 10);

      // X-axis Category label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Arial, sans-serif";
      ctx.fillText(d.name, x, canvas.height - paddingBottom + 18);
    });
  }

  return canvas.toDataURL("image/png");
};

const drawProceduralCitationWeb = (nodes: any[]): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 1. Dark background matching the PDF theme
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, 600, 400);

  // Subtle tech grid lines
  ctx.strokeStyle = "rgba(6, 182, 212, 0.05)";
  ctx.lineWidth = 1;
  const gridSpacing = 25;
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw HUD-like outer target rings
  ctx.strokeStyle = "rgba(34, 211, 238, 0.06)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(300, 200, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(300, 200, 75, 0, Math.PI * 2);
  ctx.stroke();

  const centerX = 300;
  const centerY = 200;

  // 2. Position nodes
  const nodePositions = nodes.map((node, index) => {
    if (index === 0) {
      return { ...node, x: centerX, y: centerY };
    }
    const angle = (index / (nodes.length - 1 || 1)) * Math.PI * 2;
    const radius = 110;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  // 3. Draw connection lines
  ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
  ctx.lineWidth = 1.5;
  nodePositions.forEach(node => {
    if (Array.isArray(node.connections)) {
      node.connections.forEach((connId: string) => {
        const target = nodePositions.find(n => String(n.id) === String(connId));
        if (target) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });
    }
  });

  // 4. Draw nodes (glowing circles)
  nodePositions.forEach(node => {
    let color = "#22d3ee"; // cyan for recent / default
    if (node.type === 'draft') color = "#ec4899"; // pink
    else if (node.type === 'historical') color = "#a855f7"; // purple
    else if (node.type === 'foundational') color = "#10b981"; // emerald

    const radius = node.type === 'draft' ? 14 : 9;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, radius + 8);
    glowGrad.addColorStop(0, color);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
    ctx.fill();

    // Solid core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // White center accent
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.label || "", node.x, node.y + radius + 14);

    // Type label small
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "7px Arial, sans-serif";
    ctx.fillText(String(node.type || '').toUpperCase(), node.x, node.y + radius + 22);
  });

  // Sleek cyber design frame corners
  ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
  ctx.lineWidth = 1.5;
  const l = 15;
  // Top-left
  ctx.beginPath(); ctx.moveTo(10, 10 + l); ctx.lineTo(10, 10); ctx.lineTo(10 + l, 10); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(590 - l, 10); ctx.lineTo(590, 10); ctx.lineTo(590, 10 + l); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(10, 390 - l); ctx.lineTo(10, 390); ctx.lineTo(10 + l, 390); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(590 - l, 390); ctx.lineTo(590, 390); ctx.lineTo(590, 390 - l); ctx.stroke();

  // Watermark
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.fillText("SEMANTIC CITATION WEB MAPPING SYSTEM", 20, 375);

  return canvas.toDataURL("image/png");
};

const generateProceduralModelImage = (type: string): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const modelType = String(type || '').toLowerCase();

  // 1. Draw a sophisticated dark cyber grid background
  ctx.fillStyle = "#0a0e17";
  ctx.fillRect(0, 0, 500, 300);

  // Draw a subtle grid
  ctx.strokeStyle = "rgba(6, 182, 212, 0.05)";
  ctx.lineWidth = 1;
  const gridSpacing = 20;
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw subtle circular target lines (cyber / radar effect)
  ctx.strokeStyle = "rgba(6, 182, 212, 0.1)";
  ctx.beginPath();
  ctx.arc(250, 150, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(250, 150, 50, 0, Math.PI * 2);
  ctx.stroke();

  // Draw crosshairs
  ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
  ctx.beginPath();
  ctx.moveTo(250, 30);
  ctx.lineTo(250, 270);
  ctx.moveTo(130, 150);
  ctx.lineTo(370, 150);
  ctx.stroke();

  const cx = 250;
  const cy = 150;

  // 2. Draw specific model structure based on type
  if (modelType.includes("atom")) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;

    // Draw electron orbits (3 rotated ellipses)
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(0, 0, 90, 30, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
      }
      ctx.stroke();
      
      // Draw an electron on the orbit
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(90 * Math.cos(i + 1), 30 * Math.sin(i + 1), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw nucleus (central glowing sphere)
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
    grad.addColorStop(0, "#c084fc");
    grad.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
  } else if (modelType.includes("molecule") || modelType.includes("bond")) {
    const nodes = [
      { x: cx, y: cy, color: "#10b981", r: 18 },
      { x: cx - 60, y: cy - 40, color: "#f59e0b", r: 12 },
      { x: cx + 60, y: cy - 30, color: "#f59e0b", r: 12 },
      { x: cx - 40, y: cy + 50, color: "#ef4444", r: 14 },
      { x: cx + 50, y: cy + 40, color: "#3b82f6", r: 10 }
    ];

    // Draw bonds (lines)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    for (let i = 1; i < nodes.length; i++) {
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[i].x, nodes[i].y);
      ctx.stroke();
    }

    // Draw node atoms
    nodes.forEach(node => {
      const grad = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, node.r);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, node.color);
      grad.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  } else if (modelType.includes("dna") || modelType.includes("helix")) {
    ctx.lineWidth = 2.5;
    const amplitude = 35;
    const frequency = 0.05;
    const points = 60;
    const xStart = cx - 120;
    const step = 240 / points;

    for (let i = 0; i <= points; i++) {
      const x = xStart + i * step;
      const angle = i * frequency * Math.PI;
      const y1 = cy + Math.sin(angle) * amplitude;
      const y2 = cy + Math.sin(angle + Math.PI) * amplitude;

      // Draw connecting base pairs at intervals
      if (i % 4 === 0) {
        ctx.strokeStyle = i % 8 === 0 ? "rgba(16, 185, 129, 0.6)" : "rgba(236, 72, 153, 0.6)";
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();

        // Base pair nodes
        ctx.fillStyle = i % 8 === 0 ? "#10b981" : "#ec4899";
        ctx.beginPath();
        ctx.arc(x, y1, 3.5, 0, Math.PI * 2);
        ctx.arc(x, y2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Strand 1 (Cyan)
    ctx.strokeStyle = "#22d3ee";
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = xStart + i * step;
      const y = cy + Math.sin(i * frequency * Math.PI) * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Strand 2 (Magenta)
    ctx.strokeStyle = "#e879f9";
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = xStart + i * step;
      const y = cy + Math.sin(i * frequency * Math.PI + Math.PI) * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (modelType.includes("network") || modelType.includes("brain") || modelType.includes("graph")) {
    const numNodes = 12;
    const netNodes: { x: number, y: number, r: number, color: string }[] = [];
    for (let i = 0; i < numNodes; i++) {
      const angle = (i * Math.PI * 2) / numNodes;
      const distance = 50 + Math.random() * 45;
      netNodes.push({
        x: cx + Math.cos(angle) * distance + (Math.random() - 0.5) * 15,
        y: cy + Math.sin(angle) * distance + (Math.random() - 0.5) * 15,
        r: 4 + Math.random() * 4,
        color: i % 2 === 0 ? "#a855f7" : "#06b6d4"
      });
    }

    // Draw links with distance-based alpha
    ctx.lineWidth = 1;
    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        const dx = netNodes[i].x - netNodes[j].x;
        const dy = netNodes[i].y - netNodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.strokeStyle = `rgba(34, 211, 238, ${1 - dist / 100})`;
          ctx.beginPath();
          ctx.moveTo(netNodes[i].x, netNodes[i].y);
          ctx.lineTo(netNodes[j].x, netNodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    netNodes.forEach(node => {
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      // Glow ring
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r + 3, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (modelType.includes("chip") || modelType.includes("processor") || modelType.includes("silicon")) {
    ctx.fillStyle = "#1e1e30";
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    
    // Central chip die
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - 50, cy - 50, 100, 100, 8);
    } else {
      ctx.rect(cx - 50, cy - 50, 100, 100);
    }
    ctx.fill();
    ctx.stroke();

    // Draw micro-grid inside chip die
    ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
    ctx.lineWidth = 1;
    for (let i = -40; i <= 40; i += 20) {
      ctx.beginPath();
      ctx.moveTo(cx + i, cy - 40);
      ctx.lineTo(cx + i, cy + 40);
      ctx.moveTo(cx - 40, cy + i);
      ctx.lineTo(cx + 40, cy + i);
      ctx.stroke();
    }

    // Chip pins and circuit traces
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    const offsets = [-35, -15, 15, 35];
    offsets.forEach(offset => {
      // Top pins
      ctx.beginPath();
      ctx.moveTo(cx + offset, cy - 50);
      ctx.lineTo(cx + offset, cy - 80);
      ctx.lineTo(cx + offset + (offset > 0 ? 20 : -20), cy - 100);
      ctx.stroke();

      // Bottom pins
      ctx.beginPath();
      ctx.moveTo(cx + offset, cy + 50);
      ctx.lineTo(cx + offset, cy + 80);
      ctx.lineTo(cx + offset + (offset > 0 ? 20 : -20), cy + 100);
      ctx.stroke();

      // Left pins
      ctx.beginPath();
      ctx.moveTo(cx - 50, cy + offset);
      ctx.lineTo(cx - 80, cy + offset);
      ctx.lineTo(cx - 100, cy + offset + (offset > 0 ? 20 : -20));
      ctx.stroke();

      // Right pins
      ctx.beginPath();
      ctx.moveTo(cx + 50, cy + offset);
      ctx.lineTo(cx + 80, cy + offset);
      ctx.lineTo(cx + 100, cy + offset + (offset > 0 ? 20 : -20));
      ctx.stroke();
    });

    // Central core logo
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (modelType.includes("quantum") || modelType.includes("state")) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
    grad.addColorStop(0, "rgba(236, 72, 153, 0.3)");
    grad.addColorStop(0.5, "rgba(139, 92, 246, 0.15)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.fill();

    // Draw quantum waves (concentric dashed arcs)
    ctx.lineWidth = 1.5;
    for (let r = 30; r <= 90; r += 20) {
      ctx.strokeStyle = r % 40 === 0 ? "#ec4899" : "#06b6d4";
      ctx.setLineDash([5, 5 + r/10]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Central particle in superposition
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (modelType.includes("galaxy") || modelType.includes("spiral")) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.2);

    // Draw 2 spiral arms
    for (let arm = 0; arm < 2; arm++) {
      const armColor = arm === 0 ? "#ec4899" : "#3b82f6";
      ctx.fillStyle = armColor;
      ctx.strokeStyle = armColor;
      
      const a = 5;
      const b = 0.25;
      for (let i = 0; i < 150; i++) {
        const theta = (i * Math.PI) / 25;
        const r = a * Math.exp(b * theta);
        if (r > 120) break;
        
        const angle = theta + arm * Math.PI;
        const sx = r * Math.cos(angle);
        const sy = r * Math.sin(angle);
        
        const size = Math.max(0.5, 3 * (1 - r / 120));
        ctx.beginPath();
        ctx.arc(sx + (Math.random() - 0.5) * (r * 0.15), sy + (Math.random() - 0.5) * (r * 0.15), size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glowing galactic core
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, "#f59e0b");
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (modelType.includes("globe") || modelType.includes("satellite") || modelType.includes("orbit")) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    
    // Outer border circle
    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.stroke();

    // Longitude lines (ellipses)
    for (let r = 20; r < 75; r += 20) {
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(cx, cy, r, 75, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // Latitude lines
    for (let yOffset = -50; yOffset <= 50; yOffset += 25) {
      if (yOffset === 0) {
        ctx.beginPath();
        ctx.moveTo(cx - 75, cy);
        ctx.lineTo(cx + 75, cy);
        ctx.stroke();
      } else {
        const w = Math.sqrt(75 * 75 - yOffset * yOffset);
        ctx.beginPath();
        ctx.moveTo(cx - w, cy + yOffset);
        ctx.lineTo(cx + w, cy + yOffset);
        ctx.stroke();
      }
    }
  } else if (modelType.includes("crystal") || modelType.includes("structure")) {
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(16, 185, 129, 0.1)";

    // Draw crystal facets
    const vertices = [
      { x: cx, y: cy - 70 },      // top
      { x: cx - 50, y: cy - 10 },  // left top
      { x: cx + 50, y: cy - 10 },  // right top
      { x: cx, y: cy + 70 },      // bottom
      { x: cx - 40, y: cy + 20 },  // left bottom
      { x: cx + 40, y: cy + 20 }   // right bottom
    ];

    // Outer outline
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[4].x, vertices[4].y);
    ctx.lineTo(vertices[3].x, vertices[3].y);
    ctx.lineTo(vertices[5].x, vertices[5].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Facet interior lines
    ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[3].x, vertices[3].y); // vertical axis

    ctx.moveTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y); // horizontal axis

    ctx.moveTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[3].x, vertices[3].y);

    ctx.moveTo(vertices[2].x, vertices[2].y);
    ctx.lineTo(vertices[3].x, vertices[3].y);

    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[4].x, vertices[4].y);

    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[5].x, vertices[5].y);

    ctx.stroke();
  } else if (modelType.includes("wave") || modelType.includes("pulse")) {
    ctx.lineWidth = 2;
    const numWaves = 4;
    for (let w = 0; w < numWaves; w++) {
      ctx.strokeStyle = w % 2 === 0 ? "#06b6d4" : "#ec4899";
      ctx.beginPath();
      const startX = cx - 120;
      const width = 240;
      for (let x = 0; x <= width; x++) {
        const px = startX + x;
        const wavePhase = (w * Math.PI) / numWaves;
        const py = cy + Math.sin(x * 0.05 + wavePhase) * 25 * Math.sin(x * 0.012);
        if (x === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (modelType.includes("gear") || modelType.includes("engine")) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "rgba(245, 158, 11, 0.08)";

    const outerR = 60;
    const innerR = 40;
    const numTeeth = 12;

    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    for (let i = 0; i < numTeeth * 2; i++) {
      const angle = (i * Math.PI) / numTeeth;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central axle hole
    ctx.fillStyle = "#0a0e17";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    // High-tech 3D skeleton blueprint (Geometry default)
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(139, 92, 246, 0.05)";

    const wNodes = [
      { x: cx, y: cy - 70 },
      { x: cx + 60, y: cy - 20 },
      { x: cx + 60, y: cy + 40 },
      { x: cx, y: cy + 70 },
      { x: cx - 60, y: cy + 40 },
      { x: cx - 60, y: cy - 20 }
    ];

    ctx.beginPath();
    ctx.moveTo(wNodes[0].x, wNodes[0].y);
    for (let i = 1; i < wNodes.length; i++) {
      ctx.lineTo(wNodes[i].x, wNodes[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(wNodes[0].x, wNodes[0].y);
    ctx.moveTo(cx, cy);
    ctx.lineTo(wNodes[2].x, wNodes[2].y);
    ctx.moveTo(cx, cy);
    ctx.lineTo(wNodes[4].x, wNodes[4].y);
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    [...wNodes, { x: cx, y: cy }].forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw a sleek HUD bounding-box border
  ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
  ctx.lineWidth = 1.5;
  const edgeLen = 15;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(10, 10 + edgeLen);
  ctx.lineTo(10, 10);
  ctx.lineTo(10 + edgeLen, 10);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(490 - edgeLen, 10);
  ctx.lineTo(490, 10);
  ctx.lineTo(490, 10 + edgeLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(10, 290 - edgeLen);
  ctx.lineTo(10, 290);
  ctx.lineTo(10 + edgeLen, 290);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(490 - edgeLen, 290);
  ctx.lineTo(490, 290);
  ctx.lineTo(490, 290 - edgeLen);
  ctx.stroke();

  // Add small diagnostic watermark "LUMEN SCHEMATIC v1.0"
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("LUMEN ACTIVE SCHEMATIC ENGINE v1.0", 25, 275);
  ctx.textAlign = "right";
  ctx.fillText(`PROJECTION: ${type.toUpperCase()}`, 475, 25);

  return canvas.toDataURL("image/png");
};

export const exportToPDF = async (research: ResearchPaper) => {
  const doc = new jsPDF({ format: 'letter' });
  const margin = 25.4; // 1 inch margins all around
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const contentWidth = pw - margin * 2;
  const lineHeight = 8; // Roughly double spaced for 12pt font
  
  let currentY = margin;

  const addNewPage = () => {
    doc.addPage();
    currentY = margin;
  };

  const getCleanText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/#/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014\u2015]/g, '-')
      .replace(/[\u2022\u2023\u2043\u2219]/g, '-')
      .replace(/•/g, '-')
      .replace(/[➔➜→➞➝⇒➡➤▶]/g, '->')
      .replace(/[←⇐⬅◀]/g, '<-')
      .replace(/[✓✔☑]/g, '[x]')
      .replace(/[☐☒]/g, '[ ]')
      .replace(/[★☆✦✧✥✦]/g, '*')
      .replace(/[\uD800-\uDFFF]./g, '');
  };

  doc.setFont("times", "normal");
  
  // PAGE 1: Title Page
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(getCleanText(research.topic), contentWidth);
  
  // Move down to top third of page
  currentY = ph / 3;
  
  doc.setFont("times", "bold");
  for (const line of titleLines) {
    doc.text(line, pw / 2, currentY, { align: "center" });
    currentY += lineHeight;
  }
  
  currentY += lineHeight; // extra space
  doc.setFont("times", "normal");
  doc.text("Lumen AI", pw / 2, currentY, { align: "center" });
  currentY += lineHeight;
  doc.text("Research Department", pw / 2, currentY, { align: "center" });
  currentY += lineHeight;
  doc.text(new Date().toLocaleDateString(), pw / 2, currentY, { align: "center" });
  
  // PAGE 2: Abstract
  // We extract the abstract from the paper text if it exists, otherwise use summary
  const mdText = research.paper || "";
  const lines = mdText.split('\n');
  let abstractText = research.summary || "";
  let inAbstract = false;
  let bodyLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const llower = line.toLowerCase();
    
    if (llower.includes('abstract') && line.startsWith('#')) {
      inAbstract = true;
      abstractText = ""; // overwrite with paper's actual abstract
      continue;
    } else if (inAbstract && line.startsWith('#')) {
      inAbstract = false;
    }
    
    if (inAbstract) {
      if (line) abstractText += (abstractText ? " " : "") + line;
    } else {
      if (llower.includes('body') && line.startsWith('#')) {
        continue; // skip the 'Body' heading
      }
      bodyLines.push(line);
    }
  }

  if (abstractText) {
    addNewPage();
    doc.setFont("times", "bold");
    doc.text("Abstract", pw / 2, currentY, { align: "center" });
    currentY += lineHeight * 1.5;
    
    doc.setFont("times", "normal");
    const summaryLines = doc.splitTextToSize(getCleanText(abstractText), contentWidth);
    for (const line of summaryLines) {
      if (currentY > ph - margin) addNewPage();
      doc.text(line, margin, currentY);
      currentY += lineHeight;
    }
  }

  // PAGE 3: Body
  addNewPage();
  
  for (let i = 0; i < bodyLines.length; i++) {
    let line = bodyLines[i].trim();
    if (!line) continue;
    
    // Check if it's a heading
    if (line.match(/^#+\s/)) {
      // If the heading is just the topic title, skip it to avoid duplication or unwanted topic headings
      const headingText = getCleanText(line.replace(/^#+\s/, ''));
      if (headingText.toLowerCase() === getCleanText(research.topic).toLowerCase()) {
        continue;
      }
      
      const isLevel1 = line.startsWith('# ') || line.startsWith('## ') || line.toLowerCase().includes('conclusion') || line.toLowerCase().includes('introduction') || line.toLowerCase().includes('abstract');
      
      if (isLevel1 && currentY > margin) {
        addNewPage();
      }
      
      doc.setFont("times", "bold");
      const hLines = doc.splitTextToSize(headingText, contentWidth);
      for (const hline of hLines) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        doc.text(hline, isLevel1 ? pw / 2 : margin, currentY, { align: isLevel1 ? "center" : "left" });
        currentY += lineHeight;
      }
    } else {
      // Paragraph
      doc.setFont("times", "normal");
      
      // Add indentation for proper APA
      let isList = line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line);
      const cleanPara = getCleanText(line).replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      const pLines = doc.splitTextToSize(cleanPara, contentWidth - (isList ? 10 : 0));
      
      for (let j = 0; j < pLines.length; j++) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        
        let x = margin;
        if (isList) {
          x = margin + 10;
          if (j === 0) {
            // Draw bullet or number
            const marker = line.match(/^(\d+\.)/)?.[1] || "-";
            doc.text(marker, margin + 4, currentY);
          }
        } else if (j === 0 && !isList) {
          x = margin + 12.7; // 0.5 inch indent for first line of paragraph
        }
        
        doc.text(pLines[j], x, currentY);
        currentY += lineHeight;
      }
    }
  }

  // Citations Page
  if (research.citations && research.citations.length > 0) {
    addNewPage();
    doc.setFont("times", "bold");
    doc.text("References", pw / 2, currentY, { align: "center" });
    currentY += lineHeight * 1.5;
    
    doc.setFont("times", "normal");
    for (const cite of research.citations) {
      const citeText = `${cite.title}. Retrieved from ${cite.url}`;
      const cLines = doc.splitTextToSize(getCleanText(citeText), contentWidth);
      for (let j = 0; j < cLines.length; j++) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        
        // Hanging indent for references
        let x = j === 0 ? margin : margin + 12.7;
        doc.text(cLines[j], x, currentY);
        currentY += lineHeight;
      }
      currentY += lineHeight / 2; // Extra spacing between references
    }
  }

  // Data Visualizations Page
  if (research.visualizations && research.visualizations.length > 0) {
    addNewPage();
    doc.setFont("times", "bold");
    doc.text("Data Visualizations", pw / 2, currentY, { align: "center" });
    currentY += lineHeight * 1.5;
    
    for (const viz of research.visualizations) {
      if (currentY + lineHeight * 4 > ph - margin) addNewPage();
      
      doc.setFont("times", "bold");
      const vTitleLines = doc.splitTextToSize("Chart: " + getCleanText(viz.title), contentWidth);
      for (const line of vTitleLines) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        doc.text(line, margin, currentY);
        currentY += lineHeight;
      }
      
      doc.setFont("times", "normal");
      currentY += lineHeight * 0.5;
      
      try {
        let imgData: string;
        try {
          imgData = await fetchImageAsBase64(getQuickChartUrl(viz));
        } catch (fetchErr) {
          console.warn("Failed to fetch QuickChart, generating local procedural chart...", fetchErr);
          imgData = drawProceduralChart(viz);
        }
        
        const imgWidth = contentWidth;
        const imgHeight = (imgWidth * 300) / 600; // aspect ratio w=600, h=300

        if (currentY + imgHeight > ph - margin) addNewPage();
        
        doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + lineHeight;
      } catch (err) {
        console.error("Failed to render chart image, printing textual list as final fallback", err);
        for (const d of normalizeChartData(viz.data)) {
          if (currentY + lineHeight > ph - margin) addNewPage();
          doc.text(`${d.name}: ${d.value}`, margin + 10, currentY);
          currentY += lineHeight;
        }
        currentY += lineHeight; // extra space between charts
      }
    }
  }

  // Concept Models Page
  if (research.conceptModels && research.conceptModels.length > 0) {
    addNewPage();
    doc.setFont("times", "bold");
    doc.text("Interactive 3D Schematics Output", pw / 2, currentY, { align: "center" });
    currentY += lineHeight * 1.5;
    
    for (const model of research.conceptModels) {
      if (currentY + lineHeight * 4 > ph - margin) addNewPage();
      
      doc.setFont("times", "bold");
      const vTitleLines = doc.splitTextToSize("Concept: " + getCleanText(model.term) + " [" + getCleanText(model.type) + "]", contentWidth);
      for (const line of vTitleLines) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        doc.text(line, margin, currentY);
        currentY += lineHeight;
      }
      
      doc.setFont("times", "normal");
      currentY += lineHeight * 0.5;
      
      const vDescLines = doc.splitTextToSize(getCleanText(model.description), contentWidth);
      for (const line of vDescLines) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        doc.text(line, margin, currentY);
        currentY += lineHeight;
      }
      
      const imgBase64 = getModelImageBase64(model.term, model.type);
      if (imgBase64) {
        const scaledWidth = contentWidth * 0.7; // 70% width
        const scaledHeight = scaledWidth * 0.6; // assuming relative aspect ratio
        if (currentY + scaledHeight > ph - margin) addNewPage();
        doc.addImage(imgBase64, 'PNG', pw / 2 - scaledWidth / 2, currentY, scaledWidth, scaledHeight);
        currentY += scaledHeight + lineHeight;
      }
      
      currentY += lineHeight; // extra space between models
    }
  }
  
  // Semantic Citation Web Page
  if (research.citationWeb && research.citationWeb.length > 0) {
    addNewPage();
    doc.setFont("times", "bold");
    doc.text("Semantic Citation Web Mapping", pw / 2, currentY, { align: "center" });
    currentY += lineHeight * 1.5;

    try {
      const imgData = drawProceduralCitationWeb(research.citationWeb);
      const imgWidth = contentWidth;
      const imgHeight = (imgWidth * 400) / 600; // aspect ratio w=600, h=400

      if (currentY + imgHeight > ph - margin) addNewPage();
      
      doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += imgHeight + lineHeight;
    } catch (err) {
      console.error("Failed to render citation web image", err);
    }

    // Also list the citation connections textually
    doc.setFont("times", "bold");
    if (currentY + lineHeight > ph - margin) addNewPage();
    doc.text("Citation Node Mapping & Influence Paths:", margin, currentY);
    currentY += lineHeight * 1.2;

    doc.setFont("times", "normal");
    for (const node of research.citationWeb) {
      const connectedLabels = node.connections
        .map(connId => research.citationWeb?.find(n => String(n.id) === String(connId))?.label)
        .filter(Boolean);

      const connText = connectedLabels.length > 0 ? connectedLabels.join(", ") : "No direct connections";
      const entryText = `${node.label} [${node.type.toUpperCase()}] -> connects to: ${connText}`;
      const eLines = doc.splitTextToSize(getCleanText(entryText), contentWidth);
      
      for (const line of eLines) {
        if (currentY + lineHeight > ph - margin) addNewPage();
        doc.text(line, margin + 4, currentY);
        currentY += lineHeight;
      }
      currentY += lineHeight * 0.3;
    }
  }

  // Page numbers
  const pageCount: number = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
  doc.setFont("times", "normal");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(i.toString(), pw - margin, margin - 10, { align: "right" });
  }

  doc.save(`${research.topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.pdf`);
};

import QRCode from 'qrcode';

export const exportToDOCX = async (research: ResearchPaper) => {
  const getCleanText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/#/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014\u2015]/g, '-')
      .replace(/[\u2022\u2023\u2043\u2219]/g, '-')
      .replace(/•/g, '-')
      .replace(/[➔➜→➞➝⇒➡➤▶]/g, '->')
      .replace(/[←⇐⬅◀]/g, '<-')
      .replace(/[✓✔☑]/g, '[x]')
      .replace(/[☐☒]/g, '[ ]')
      .replace(/[★☆✦✧✥✦]/g, '*')
      .replace(/[\uD800-\uDFFF]./g, '');
  };

  const mdText = research.paper || "";
  const lines = mdText.split('\n');
  let abstractText = research.summary || "";
  let inAbstract = false;
  let bodyLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const llower = line.toLowerCase();
    
    if (llower.includes('abstract') && line.startsWith('#')) {
      inAbstract = true;
      abstractText = ""; // overwrite with paper's actual abstract
      continue;
    } else if (inAbstract && line.startsWith('#')) {
      inAbstract = false;
    }
    
    if (inAbstract) {
      if (line) abstractText += (abstractText ? " " : "") + line;
    } else {
      if (llower.includes('body') && line.startsWith('#')) {
        continue; // skip the 'Body' heading
      }
      bodyLines.push(line);
    }
  }

  const paragraphElements: any[] = [];
  
  // Title Page
  paragraphElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2880, after: 480 }, // ~2 inches from top
      children: [new TextRun({ text: getCleanText(research.topic), bold: true })]
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Lumen AI")] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Research Department")] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(new Date().toLocaleDateString())], pageBreakBefore: false })
  );

  // Abstract Page
  if (abstractText) {
    paragraphElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        children: [new TextRun({ text: "Abstract", bold: true, size: 32 })]
      }),
      new Paragraph({
        text: getCleanText(abstractText),
        alignment: AlignmentType.LEFT,
        indent: { firstLine: 720 }, // 0.5 inch indent
      })
    );
  }

  // Body Page (Heading removed to match request)
  let isFirstBodyElement = true;
  for (let i = 0; i < bodyLines.length; i++) {
    let line = bodyLines[i].trim();
    if (!line) continue;
    
    // Check if it's a heading
    if (line.match(/^#+\s/)) {
      const headingText = getCleanText(line.replace(/^#+\s/, ''));
      // skip if it matches title
      if (headingText.toLowerCase() === getCleanText(research.topic).toLowerCase()) {
        continue;
      }
      
      const isLevel1 = line.startsWith('# ') || line.startsWith('## ') || line.toLowerCase().includes('conclusion') || line.toLowerCase().includes('introduction') || line.toLowerCase().includes('abstract');
      
      paragraphElements.push(
        new Paragraph({
          alignment: isLevel1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          pageBreakBefore: isFirstBodyElement || isLevel1,
          children: [new TextRun({ text: headingText, bold: true })]
        })
      );
      isFirstBodyElement = false;
    } else {
      // Paragraph
      let isList = line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line);
      const cleanPara = getCleanText(line).replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      
      paragraphElements.push(
        new Paragraph({
          text: cleanPara,
          alignment: AlignmentType.LEFT,
          pageBreakBefore: isFirstBodyElement,
          bullet: isList ? { level: 0 } : undefined,
          indent: !isList ? { firstLine: 720 } : undefined,
        })
      );
      isFirstBodyElement = false;
    }
  }

  // References
  if (research.citations && research.citations.length > 0) {
    paragraphElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        children: [new TextRun({ text: "References", bold: true, size: 32 })]
      })
    );
    
    for (const cite of research.citations) {
      paragraphElements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${cite.title}. Retrieved from ` }),
            new TextRun({ text: cite.url, color: "0000FF", underline: {} })
          ],
          indent: {
            left: 720,
            hanging: 720
          }
        })
      );
    }
  }

  // Data Visualizations Page
  if (research.visualizations && research.visualizations.length > 0) {
    paragraphElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        children: [new TextRun({ text: "Data Visualizations", bold: true, size: 32 })]
      })
    );
    
    for (const viz of research.visualizations) {
      paragraphElements.push(
        new Paragraph({ 
          children: [new TextRun({ text: `Chart: ${viz.title}`, bold: true })] 
        })
      );
      
      try {
        let imgBuffer: ArrayBuffer;
        try {
          imgBuffer = await fetchImageAsArrayBuffer(getQuickChartUrl(viz));
        } catch (fetchErr) {
          console.warn("Failed to fetch QuickChart for DOCX, generating local procedural chart...", fetchErr);
          const base64Img = drawProceduralChart(viz);
          const base64Data = base64Img.replace(/^data:image\/(png|jpeg);base64,/, "");
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let k = 0; k < len; k++) {
            bytes[k] = binaryString.charCodeAt(k);
          }
          imgBuffer = bytes.buffer;
        }

        paragraphElements.push(new Paragraph({
          children: [
            new ImageRun({
              data: new Uint8Array(imgBuffer),
              transformation: {
                width: 500,
                height: 250
              },
              type: "png"
            })
          ],
          alignment: AlignmentType.CENTER,
        }));
      } catch (e) {
        paragraphElements.push(...normalizeChartData(viz.data).map((d: any) => 
          new Paragraph({ text: `${d.name}: ${d.value}`, bullet: { level: 0 } })
        ));
      }
    }
  }

  // Concept Models Page
  if (research.conceptModels && research.conceptModels.length > 0) {
    paragraphElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        children: [new TextRun({ text: "Interactive 3D Schematics Output", bold: true, size: 32 })]
      })
    );
    
    for (const model of research.conceptModels) {
      paragraphElements.push(
        new Paragraph({ 
          children: [new TextRun({ text: `Concept: ${getCleanText(model.term)} [${getCleanText(model.type)}]`, bold: true })] 
        }),
        new Paragraph({
          text: getCleanText(model.description || ""),
          alignment: AlignmentType.LEFT,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Scan or click the link to interact with the 3D 'Living' Document: ", italics: true }),
            new TextRun({ text: `https://ais-dev-rwl6phgw6be6jmao7lb7id-780988923826.asia-east1.run.app/?model=${encodeURIComponent(model.term)}`, color: "0000FF", underline: {} })
          ],
          alignment: AlignmentType.LEFT,
         })
      );
      
      const imgBase64 = getModelImageBase64(model.term, model.type);
      if (imgBase64) {
        try {
          const base64Data = imgBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          paragraphElements.push(new Paragraph({
            children: [
              new ImageRun({
                data: bytes,
                transformation: {
                  width: 400,
                  height: 240
                },
                type: "png"
              })
            ],
            alignment: AlignmentType.CENTER,
          }));
        } catch (e) {
          console.error("Failed to insert model image into docx", e);
        }
      }

      // Generate QR Code base64
      try {
        const qrDataUrl = await QRCode.toDataURL(`https://ais-dev-rwl6phgw6be6jmao7lb7id-780988923826.asia-east1.run.app/?model=${encodeURIComponent(model.term)}`);
        const qrBase64Data = qrDataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
        const qrBinaryString = window.atob(qrBase64Data);
        const qrLen = qrBinaryString.length;
        const qrBytes = new Uint8Array(qrLen);
        for (let i = 0; i < qrLen; i++) {
          qrBytes[i] = qrBinaryString.charCodeAt(i);
        }
        
        paragraphElements.push(new Paragraph({
          children: [
            new ImageRun({
              data: qrBytes,
              transformation: {
                width: 100,
                height: 100
              },
              type: "png"
            })
          ],
          alignment: AlignmentType.CENTER,
        }));
      } catch (err) {
        console.error('QR code generation failed', err);
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            size: 24, // 12pt
            font: "Times New Roman",
          },
          paragraph: {
            spacing: {
              line: 480, // Double spaced
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: paragraphElements,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${research.topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.docx`;
  link.click();
};

export const exportToLaTeX = (research: ResearchPaper) => {
  let latexPaper = "";
  const lines = (research.paper || "").split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^#+\s/)) {
      const isLevel1 = line.startsWith('# ') || line.startsWith('## ') || line.toLowerCase().includes('conclusion') || line.toLowerCase().includes('introduction') || line.toLowerCase().includes('abstract');
      const heading = line.replace(/^#+\s/, '');
      if (heading.toLowerCase() === research.topic.toLowerCase()) continue;
      
      if (isLevel1) {
        latexPaper += `\n\\clearpage\n\\section*{${heading}}\n`;
      } else {
        latexPaper += `\n\\subsection*{${heading}}\n`;
      }
    } else {
      let l = line.replace(/#/g, '\\#').replace(/_/g, '\\_');
      let parts = l.split("**");
      let formatted = "";
      for (let j=0; j<parts.length; j++) {
        if (j%2 === 1) formatted += `\\textbf{${parts[j]}}`;
        else formatted += parts[j];
      }
      latexPaper += formatted + "\n\n";
    }
  }

  const latex = `
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{qrcode}
\\pgfplotsset{compat=1.18}

\\title{${research.topic.replace(/#/g, '\\#')}}
\\author{Lumen AI Research Engine}
\\date{\\today}

\\begin{document}

\\maketitle

${latexPaper}

\\clearpage
\\begin{thebibliography}{99}
${research.citations.map((c, i) => `\\bibitem{ref${i}} ${c.bibtex || c.title} \\\\ \\url{${c.cleanUrl || c.url}}`).join('\n')}
${research.visualizations?.map((viz, i) => `\\bibitem{viz${i}} ${viz.bibtexCitation || `Synthesized via Lumen AI (${viz.title})`}`).join('\n') || ''}
${research.conceptModels?.map((model, i) => `\\bibitem{model${i}} ${model.bibtexCitation || `3D Concept Model via Lumen AI (${model.term})`}`).join('\n') || ''}
\\end{thebibliography}

${research.visualizations && research.visualizations.length > 0 ? `
\\section*{Dynamic Visualizations (TikZ Space)}
${research.visualizations.map((viz, i) => `
\\begin{figure}[htbp]
\\centering
${viz.tikzCode ? viz.tikzCode : `
\\begin{tikzpicture}
\\begin{axis}[
    ybar,
    enlargelimits=0.15,
    legend style={at={(0.5,-0.15)},
      anchor=north,legend columns=-1},
    ylabel={Value},
    symbolic x coords={${normalizeChartData(viz.data).map(d => d.name).join(',')}},
    xtick=data,
    nodes near coords,
    nodes near coords align={vertical},
    ]
\\addplot coordinates {${normalizeChartData(viz.data).map(d => `(${d.name},${d.value})`).join(' ')}};
\\end{axis}
\\end{tikzpicture}
`}
\\caption{${viz.title} \\cite{viz${i}}}
\\end{figure}
`).join('\n')}
` : ''}

${research.conceptModels && research.conceptModels.length > 0 ? `
\\section*{Active "Living" Document Links: 3D Schematics}
${research.conceptModels.map((model, i) => `
\\subsection*{Interactive Concept: ${model.term} [${model.type}]}
\\textbf{Description:} ${model.description} \\\\

Scan to access the living 3D interactive model \\cite{model${i}}: \\\\
\\qrcode{https://ais-dev-rwl6phgw6be6jmao7lb7id-780988923826.asia-east1.run.app/?model=${encodeURIComponent(model.term)}} \\\\
\\url{https://ais-dev-rwl6phgw6be6jmao7lb7id-780988923826.asia-east1.run.app/?model=${encodeURIComponent(model.term)}}
`).join('\n')}
` : ''}

\\end{document}
  `;
  
  const blob = new Blob([latex], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${research.topic.replace(/\s+/g, '_')}.tex`;
  link.click();
};
