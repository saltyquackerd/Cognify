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
  const size = data.size || 60;
  const radius = size / 2;
  
  return (
    <div 
      className="shadow-md backdrop-blur-sm relative flex items-center justify-center"
      style={{ 
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: data.color || '#ffffff',
        color: data.textColor || '#374151',
        border: 'none',
        opacity: 0.8
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
        style={{ left: -6 }}
      />
      <div className="text-center">
        <div className="font-medium text-xs leading-tight">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400"
        style={{ right: -6 }}
      />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomNode,
};

// Helper function to assign colors to nodes based on topic
const getNodeColor = (topic: string): string => {
  const colors = [
    '#E0E7FF', // Light blue
    '#D1FAE5', // Light green
    '#F3E8FF', // Light purple
    '#FEF3C7', // Light yellow
    '#FED7D7', // Light red
    '#E6FFFA', // Light teal
    '#FFF5F5', // Light pink
    '#F0FDF4', // Light lime
  ];
  
  // Simple hash function to consistently assign colors
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
        // Call your backend API endpoint
        const response = await fetch('http://localhost:5000/api/knowledge-graph');
        
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge graph data');
        }
        
        const data = await response.json();
        console.log('Knowledge graph API response:', data);
        
        // Transform API data to React Flow format
        // Backend returns: { topics: [...], edges: [[source, target], ...] }
        const topics = data.topics || [];
        const edgeList = data.edges || [];
        
        // Calculate node degrees (number of connections)
        const nodeDegrees = new Map<string, number>();
        topics.forEach((topic: string) => nodeDegrees.set(topic, 0));
        edgeList.forEach(([source, target]: [string, string]) => {
          nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
          nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
        });

        // Create nodes with force-directed positioning
        const transformedNodes = topics.map((topic: string) => {
          const degree = nodeDegrees.get(topic) || 0;
          const maxDegree = Math.max(...Array.from(nodeDegrees.values()));
          
          // Nodes with higher degree get positioned closer to center
          const centralityFactor = maxDegree > 0 ? degree / maxDegree : 0;
          const baseRadius = 150 + (1 - centralityFactor) * 200; // High degree = smaller radius
          
          // Calculate node size based on degree (more connections = bigger circle)
          const minSize = 40;
          const maxSize = 100;
          const nodeSize = maxDegree > 0 
            ? minSize + (degree / maxDegree) * (maxSize - minSize)
            : minSize;
          
          // Add randomization
          const angle = Math.random() * 2 * Math.PI;
          const radiusVariation = (Math.random() - 0.5) * 100;
          const finalRadius = Math.max(50, baseRadius + radiusVariation);
          
          const x = 400 + finalRadius * Math.cos(angle);
          const y = 300 + finalRadius * Math.sin(angle);
          
          return {
            id: topic,
            type: 'customNode',
            position: { x, y },
            data: {
              label: topic,
              color: getNodeColor(topic),
              textColor: '#374151',
              category: `Topic (${degree} connections)`,
              originalColor: getNodeColor(topic),
              size: nodeSize
            }
          };
        });
        
        // Create edges from edge list
        const transformedEdges = edgeList.map((edge: [string, string], index: number) => ({
          id: `edge-${index}`,
          source: edge[0],
          target: edge[1],
          type: 'straight',
          animated: false,
          style: {
            stroke: '#9CA3AF',
            strokeWidth: 2,
            opacity: 1
          },
          labelStyle: { fill: '#6B7280', fontWeight: 500 }
        }));
        
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

  // Handle node selection and highlighting
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    
    // Get connected node IDs
    const connectedNodeIds = new Set<string>();
    const connectedEdgeIds = new Set<string>();
    
    edges.forEach(edge => {
      if (edge.source === node.id || edge.target === node.id) {
        connectedEdgeIds.add(edge.id);
        connectedNodeIds.add(edge.source === node.id ? edge.target : edge.source);
      }
    });
    
    // Update nodes with highlighting (keep original colors, only change opacity)
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          color: n.data.originalColor, // Keep original colors
          textColor: '#374151' // Keep original text color
        },
        style: {
          opacity: n.id === node.id || connectedNodeIds.has(n.id) ? 1 : 0.3
        }
      }))
    );
    
    // Update edges with highlighting
    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        style: {
          ...e.style,
          stroke: connectedEdgeIds.has(e.id) ? '#3B82F6' : '#9CA3AF',
          strokeWidth: connectedEdgeIds.has(e.id) ? 3 : 2,
          opacity: connectedEdgeIds.has(e.id) ? 1 : 0.2
        }
      }))
    );
  }, [edges, setNodes, setEdges]);

  // Handle clearing selection when clicking on empty space
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    
    // Reset all nodes to original colors
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          color: n.data.originalColor,
          textColor: '#374151'
        },
        style: {
          opacity: 1
        }
      }))
    );
    
    // Reset all edges to original styles
    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        style: {
          ...e.style,
          stroke: '#9CA3AF',
          strokeWidth: 2,
          opacity: 1
        }
      }))
    );
  }, [setNodes, setEdges]);

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
        category: 'Custom',
        originalColor: '#F3E8FF'
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
            onPaneClick={onPaneClick}
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
