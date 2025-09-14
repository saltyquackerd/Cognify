'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
}

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Sample knowledge graph data
  useEffect(() => {
    const sampleNodes: Node[] = [
      { id: 'ai', label: 'Artificial Intelligence', x: 400, y: 200, color: '#3B82F6', size: 40 },
      { id: 'ml', label: 'Machine Learning', x: 200, y: 300, color: '#10B981', size: 35 },
      { id: 'dl', label: 'Deep Learning', x: 100, y: 400, color: '#8B5CF6', size: 30 },
      { id: 'nlp', label: 'Natural Language Processing', x: 600, y: 300, color: '#F59E0B', size: 35 },
      { id: 'cv', label: 'Computer Vision', x: 300, y: 450, color: '#EF4444', size: 30 },
      { id: 'nn', label: 'Neural Networks', x: 150, y: 150, color: '#06B6D4', size: 32 },
      { id: 'transformers', label: 'Transformers', x: 700, y: 400, color: '#84CC16', size: 28 },
      { id: 'gpt', label: 'GPT Models', x: 800, y: 200, color: '#F97316', size: 25 },
    ];

    const sampleEdges: Edge[] = [
      { from: 'ai', to: 'ml', label: 'includes' },
      { from: 'ml', to: 'dl', label: 'subset of' },
      { from: 'ml', to: 'cv', label: 'enables' },
      { from: 'ai', to: 'nlp', label: 'includes' },
      { from: 'dl', to: 'nn', label: 'uses' },
      { from: 'nlp', to: 'transformers', label: 'uses' },
      { from: 'transformers', to: 'gpt', label: 'powers' },
      { from: 'nn', to: 'dl', label: 'foundation of' },
    ];

    setNodes(sampleNodes);
    setEdges(sampleEdges);
  }, []);

  // Draw the knowledge graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 2;
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Draw edge label
        if (edge.label) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;
          ctx.fillStyle = '#6B7280';
          ctx.font = '12px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY - 5);
        }
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      
      // Add border if selected
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw node label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + 4);
    });
  }, [nodes, edges, selectedNode]);

  // Handle mouse events
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicking on a node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= node.size;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
      setIsDragging(true);
      setDragOffset({
        x: x - clickedNode.x,
        y: y - clickedNode.y
      });
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedNode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update node position
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === selectedNode.id
          ? { ...node, x: x - dragOffset.x, y: y - dragOffset.y }
          : node
      )
    );

    setSelectedNode(prev => prev ? {
      ...prev,
      x: x - dragOffset.x,
      y: y - dragOffset.y
    } : null);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Knowledge Graph</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Export
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Add Node
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Graph Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Nodes</span>
                  <span className="text-sm font-medium text-gray-900">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Connections</span>
                  <span className="text-sm font-medium text-gray-900">{edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Graph Density</span>
                  <span className="text-sm font-medium text-gray-900">
                    {((edges.length / (nodes.length * (nodes.length - 1))) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {selectedNode && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Node</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Label:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedNode.label}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Connections:</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Color:</span>
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Legend</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Core Concepts</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Technologies</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-600">Methods</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-gray-600">Applications</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-white">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="w-full h-full cursor-pointer"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          
          {/* Instructions */}
          <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Click on nodes to select them</li>
              <li>• Drag nodes to reposition them</li>
              <li>• View node details in the sidebar</li>
              <li>• Use Export to save the graph</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
