'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Panel,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom node component
const CustomNode = ({ data }: { data: any }) => {
  return (
    <div 
      className="px-4 py-2 shadow-md rounded-xl min-w-[120px] text-center backdrop-blur-sm relative"
      style={{ 
        backgroundColor: data.color || '#ffffff',
        color: data.textColor || '#374151',
        border: 'none'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
      />
      <div className="font-medium text-sm">{data.label}</div>
      {data.category && (
        <div className="text-xs opacity-70 mt-1">{data.category}</div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomNode,
};

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Load knowledge graph data
  useEffect(() => {
    const loadKnowledgeGraph = async () => {
      try {
        // Replace with your actual API endpoint
        const response = await fetch('/api/knowledge-graph');
        
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge graph data');
        }
        
        const data = await response.json();
        
        // Transform API data to React Flow format if needed
        const transformedNodes = data.nodes?.map((node: any) => ({
          id: node.id,
          type: 'customNode',
          position: { x: node.x || Math.random() * 800, y: node.y || Math.random() * 600 },
          data: {
            label: node.label,
            color: node.color || '#E0E7FF',
            textColor: node.textColor || '#374151',
            category: node.category || 'Concept'
          }
        })) || [];
        
        const transformedEdges = data.edges?.map((edge: any, index: number) => ({
          id: edge.id || `edge-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: 'smoothstep',
          animated: edge.animated || false,
          style: {
            stroke: edge.color || '#9CA3AF',
            strokeWidth: edge.width || 2,
            strokeDasharray: edge.dashed ? '5,5' : '0'
          },
          labelStyle: { fill: '#6B7280', fontWeight: 500 }
        })) || [];
        
        setNodes(transformedNodes);
        setEdges(transformedEdges);
        
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
        
        // Fallback to sample data if API fails
        const fallbackNodes: Node[] = [
          {
            id: 'ai',
            type: 'customNode',
            position: { x: 400, y: 200 },
            data: { 
              label: 'Artificial Intelligence', 
              color: '#E0E7FF', 
              textColor: '#3730A3',
              category: 'Core Concept'
            }
          },
          {
            id: 'ml',
            type: 'customNode',
            position: { x: 200, y: 300 },
            data: { 
              label: 'Machine Learning', 
              color: '#D1FAE5', 
              textColor: '#065F46',
              category: 'Technology'
            }
          }
        ];
        
        const fallbackEdges: Edge[] = [
          { 
            id: 'e1-2', 
            source: 'ai', 
            target: 'ml', 
            label: 'includes',
            type: 'smoothstep',
            style: { stroke: '#9CA3AF', strokeWidth: 2 }
          }
        ];
        
        setNodes(fallbackNodes);
        setEdges(fallbackEdges);
      }
    };
    
    loadKnowledgeGraph();
  }, [setNodes, setEdges]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handle adding new nodes
  const onAddNode = useCallback(() => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'customNode',
      position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 },
      data: {
        label: 'New Concept',
        color: '#F3E8FF',
        textColor: '#6B21A8',
        category: 'Custom'
      }
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

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
            <button 
              onClick={onAddNode}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
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
                    {nodes.length > 1 ? ((edges.length / (nodes.length * (nodes.length - 1))) * 100).toFixed(1) : '0.0'}%
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
                    <p className="text-sm text-gray-900 mt-1">{selectedNode.data?.label}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Category:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedNode.data?.category}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Connections:</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Color:</span>
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: selectedNode.data?.color }}
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

        {/* React Flow Area */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-gray-50"
          >
            <Controls className="bg-white border border-gray-200 rounded-lg shadow-sm" />
            <MiniMap 
              className="bg-white border border-gray-200 rounded-lg shadow-sm"
              nodeColor={(node) => node.data?.color || '#6366f1'}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1}
              color="#e5e7eb"
            />
            
            {/* Instructions Panel */}
            <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-xs">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Drag nodes to reposition them</li>
                <li>• Click nodes to select and view details</li>
                <li>• Drag from node handles to create connections</li>
                <li>• Use controls to zoom and fit view</li>
                <li>• Add new nodes with the button above</li>
              </ul>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
