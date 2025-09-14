'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
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
import { API_URLS } from '../../lib/api';

// Custom node component
const CustomNode = ({ data }: { data: { label: string; color?: string; textColor?: string; size?: number; gradient?: string } }) => {
  // Calculate dynamic size based on text content
  const text = data.label || '';
  const words = text.split(' ');
  const maxWordLength = Math.max(...words.map((word: string) => word.length));
  
  // More generous text width calculation to prevent cutting
  const maxTextWidth = 80; // Increased maximum width
  const textWidth = Math.min(maxTextWidth, Math.max(50, maxWordLength * 8)); // Increased multiplier
  
  // More conservative line estimation to ensure no cutting
  const avgCharsPerLine = Math.floor(textWidth / 5.5); // More conservative char estimate
  const estimatedLines = Math.max(1, Math.ceil(text.length / avgCharsPerLine));
  const lineHeight = 18; // Increased line height for better spacing
  const textHeight = estimatedLines * lineHeight;
  
  // More generous padding to ensure no cutting
  const minSize = Math.max(textWidth, textHeight) + 24; // Increased padding
  const size = Math.max(70, minSize); // Increased minimum size
  
  return (
    <div 
      className="relative flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer group"
      style={{ 
        width: size,
        height: size,
        borderRadius: '50%',
        background: data.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: data.textColor || '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.1),
          0 2px 8px rgba(0, 0, 0, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          inset 0 -1px 0 rgba(0, 0, 0, 0.1)
        `,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated background overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.3) 0%, transparent 70%)'
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
        style={{ left: -6 }}
      />
      <div 
        className="text-center px-4 relative z-10"
        style={{ 
          maxWidth: `${textWidth}px`,
          width: `${textWidth}px`,
          minHeight: `${textHeight}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        <div className="font-semibold text-xs leading-relaxed break-words whitespace-normal tracking-wide drop-shadow-sm hyphens-auto">
          {data.label}
        </div>
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

// Add a simple default node type as fallback
const defaultNodeTypes = {
  default: CustomNode,
  customNode: CustomNode,
};

// Tame, cohesive color palette with muted tones
const getNodeColor = (topic: string): { gradient: string; textColor: string } => {
  const colorSchemes = [
    { gradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', textColor: '#3730a3' },
    { gradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', textColor: '#0c4a6e' },
    { gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', textColor: '#14532d' },
    { gradient: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', textColor: '#713f12' },
    { gradient: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)', textColor: '#7f1d1d' },
    { gradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', textColor: '#831843' },
    { gradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', textColor: '#334155' },
    { gradient: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', textColor: '#581c87' },
  ];
  
  // Simple hash function to consistently assign colors
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorSchemes[Math.abs(hash) % colorSchemes.length];
};

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [mounted, setMounted] = useState(false);
  const reactFlowRef = useRef<any>(null);

  // Ensure component is mounted on client side
  useEffect(() => {
    setMounted(true);
    console.log('Component mounted, React Flow should be interactive now');
  }, []);

  // Additional effect to ensure React Flow is properly initialized
  useEffect(() => {
    if (mounted) {
      console.log('React Flow should be fully initialized now');
      // Force a re-render to ensure React Flow is properly mounted
      setTimeout(() => {
        console.log('React Flow initialization complete');
        if (reactFlowRef.current) {
          console.log('React Flow ref is set:', reactFlowRef.current);
        } else {
          console.log('React Flow ref is not set');
        }
      }, 100);
    }
  }, [mounted]);

  // Load knowledge graph data
  useEffect(() => {
    if (!mounted) return; // Only load data after component is mounted
    
    console.log('KnowledgeGraphPage mounted, React Flow should be interactive');
    console.log('Current nodes:', nodes);
    console.log('Current edges:', edges);
    const loadKnowledgeGraph = async () => {
      try {
        // Call your backend API endpoint
        const response = await fetch(API_URLS.KNOWLEDGE_GRAPH());
        
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge graph data');
        }
        
        const data = await response.json();
        console.log('Knowledge graph API response:', data);
        console.log('Topics from API:', data.topics);
        console.log('Edges from API:', data.edges);
        
        // Transform API data to React Flow format
        // Backend returns: { topics: [...], edges: [[source, target], ...] }
        const topics = data.topics || [];
        const edgeList = data.edges || [];
        
        console.log('Processed topics:', topics);
        console.log('Processed edges:', edgeList);
        
        // Calculate node degrees (number of connections)
        const nodeDegrees = new Map<string, number>();
        topics.forEach((topic: string) => nodeDegrees.set(topic, 0));
        edgeList.forEach(([source, target]: [string, string]) => {
          nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
          nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
        });

        // Create nodes with web-like positioning using force simulation
        const transformedNodes = topics.map((topic: string) => {
          const degree = nodeDegrees.get(topic) || 0;
          const maxDegree = Math.max(...Array.from(nodeDegrees.values()));
          
          // Web-like positioning: create multiple layers radiating outward
          const centralityFactor = maxDegree > 0 ? degree / maxDegree : 0;
          
          // Create web layers - more connected nodes closer to center
          let layer = 0;
          if (centralityFactor > 0.7) layer = 0; // Core nodes
          else if (centralityFactor > 0.4) layer = 1; // Secondary nodes
          else if (centralityFactor > 0.1) layer = 2; // Tertiary nodes
          else layer = 3; // Peripheral nodes
          
          const layerRadii = [80, 140, 200, 280]; // Different radii for each layer
          const baseRadius = layerRadii[layer];
          
          // Add organic variation within each layer
          const angle = Math.random() * 2 * Math.PI;
          const radiusVariation = (Math.random() - 0.5) * 40; // Smaller variation for more web-like structure
          const finalRadius = Math.max(30, baseRadius + radiusVariation);
          
          // Add some clustering based on connections
          const connectedNodes = edgeList.filter(([source, target]: [string, string]) => 
            source === topic || target === topic
          ).map(([source, target]: [string, string]) => source === topic ? target : source);
          
          // Slight clustering effect - nodes with common connections tend to be closer
          let clusterOffsetX = 0;
          let clusterOffsetY = 0;
          if (connectedNodes.length > 0) {
            clusterOffsetX = (Math.random() - 0.5) * 60;
            clusterOffsetY = (Math.random() - 0.5) * 60;
          }
          
          const x = 400 + finalRadius * Math.cos(angle) + clusterOffsetX;
          const y = 300 + finalRadius * Math.sin(angle) + clusterOffsetY;
          
          const colorScheme = getNodeColor(topic);
          return {
            id: topic,
            type: 'default', // Use default type instead of customNode
            position: { x, y },
            data: {
              label: topic,
              gradient: colorScheme.gradient,
              textColor: colorScheme.textColor,
              category: `Topic (${degree} connections)`,
              originalGradient: colorScheme.gradient,
              originalTextColor: colorScheme.textColor
            }
          };
        });
        
        // Create edges from edge list with web-like styling
        const transformedEdges = edgeList.map((edge: [string, string], index: number) => {
          const sourceDegree = nodeDegrees.get(edge[0]) || 0;
          const targetDegree = nodeDegrees.get(edge[1]) || 0;
          const edgeStrength = Math.min(sourceDegree, targetDegree);
          
          // Use consistent edge styling for better visibility
          const strokeWidth = Math.max(1.5, Math.min(3, 1.5 + edgeStrength * 0.2));
          
          // Use straight lines for clean appearance
          const edgeType = 'straight';
          
          return {
            id: `edge-${index}`,
            source: edge[0],
            target: edge[1],
            type: edgeType,
            animated: false,
            style: {
              stroke: '#9ca3af',
              strokeWidth: strokeWidth,
              opacity: 0.8
            },
            labelStyle: { fill: '#6B7280', fontWeight: 500 }
          };
        });
        
        console.log('Setting nodes:', transformedNodes);
        console.log('Setting edges:', transformedEdges);
        setNodes(transformedNodes);
        setEdges(transformedEdges);
        
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
        
        // Fallback to sample data if API fails
        const fallbackNodes: Node[] = [
          {
            id: 'ai',
            type: 'default',
            position: { x: 400, y: 200 },
            data: { 
              label: 'Artificial Intelligence', 
              gradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
              textColor: '#3730a3',
              category: 'Core Concept',
              originalGradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
              originalTextColor: '#3730a3'
            }
          },
          {
            id: 'ml',
            type: 'default',
            position: { x: 200, y: 300 },
            data: { 
              label: 'Machine Learning', 
              gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              textColor: '#14532d',
              category: 'Technology',
              originalGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              originalTextColor: '#14532d'
            }
          }
        ];
        
        const fallbackEdges: Edge[] = [
          { 
            id: 'e1-2', 
            source: 'ai', 
            target: 'ml', 
            label: 'includes',
            type: 'straight',
            style: { stroke: '#9ca3af', strokeWidth: 1.5, opacity: 0.8 }
          }
        ];
        
        console.log('Using fallback data - nodes:', fallbackNodes);
        console.log('Using fallback data - edges:', fallbackEdges);
        setNodes(fallbackNodes);
        setEdges(fallbackEdges);
      }
    };
    
    loadKnowledgeGraph();
  }, [mounted, setNodes, setEdges]);

  // Debug effect to track nodes and edges changes
  useEffect(() => {
    console.log('Nodes changed:', nodes);
    console.log('Edges changed:', edges);
  }, [nodes, edges]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      console.log('Connection created:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Handle node selection and highlighting
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id);
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
    
    // Update nodes with highlighting (keep original gradients, only change opacity)
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          gradient: n.data.originalGradient, // Keep original gradients
          textColor: n.data.originalTextColor // Keep original text color
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
          stroke: connectedEdgeIds.has(e.id) ? '#6366f1' : '#9ca3af',
          strokeWidth: connectedEdgeIds.has(e.id) ? 2.5 : 1.5,
          opacity: connectedEdgeIds.has(e.id) ? 1 : 0.4
        }
      }))
    );
  }, [edges, setNodes, setEdges]);

  // Handle clearing selection when clicking on empty space
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    
    // Reset all nodes to original gradients
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          gradient: n.data.originalGradient,
          textColor: n.data.originalTextColor
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
          stroke: '#9ca3af',
          strokeWidth: 1.5,
          opacity: 0.8
        }
      }))
    );
  }, [setNodes, setEdges]);

  // Handle adding new nodes
  const onAddNode = useCallback(() => {
    const colorScheme = getNodeColor('New Concept');
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 },
      data: {
        label: 'New Concept',
        gradient: colorScheme.gradient,
        textColor: colorScheme.textColor,
        category: 'Custom',
        originalGradient: colorScheme.gradient,
        originalTextColor: colorScheme.textColor
      }
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-3 hover:bg-gray-100/80 rounded-xl transition-all duration-200 hover:scale-105 group"
            >
              <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Knowledge Graph
              </h1>
              <p className="text-sm text-gray-500 font-medium">Interactive concept visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onAddNode}
              className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Add Node
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <div className="h-[calc(100vh-80px)]">
        {/* React Flow Area */}
        <div className="h-full relative">
          {/* Web-like background pattern */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 60%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)
              `,
              backgroundSize: '200px 200px, 300px 300px, 250px 250px',
              backgroundPosition: '0 0, 100px 100px, 50px 150px'
            }}
          />
          
          {/* Floating Statistics Overlay */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                Graph Stats
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Nodes:</span>
                  <span className="text-lg font-semibold text-gray-800">{nodes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Connections:</span>
                  <span className="text-lg font-semibold text-gray-800">{edges.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Density:</span>
                  <span className="text-lg font-semibold text-gray-800">
                    {nodes.length > 1 ? ((edges.length / (nodes.length * (nodes.length - 1))) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          {!mounted && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading interactive graph...</p>
              </div>
            </div>
          )}
          {mounted && (
            <div>
              <div style={{ position: 'absolute', top: 10, left: 10, background: 'red', color: 'white', padding: '5px', zIndex: 1000 }}>
                React Flow is mounted and should be interactive! Nodes: {nodes.length}, Edges: {edges.length}
              </div>
              <ReactFlow
                ref={reactFlowRef}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={defaultNodeTypes}
                fitView
                className="bg-gradient-to-br from-gray-50 to-gray-100"
                style={{ width: '100%', height: '100%' }}
              >
            <Controls className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-lg" />
            <MiniMap 
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-lg"
              nodeColor={(node) => node.data?.gradient || node.data?.color || '#6366f1'}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={30} 
              size={1}
              color="#f3f4f6"
            />
            
            {/* Instructions Panel */}
            <Panel position="top-right" className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-lg max-w-sm">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                Instructions
              </h4>
              <ul className="text-sm text-gray-600 space-y-3 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Drag nodes to reposition them
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Click nodes to select and view details
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Drag from handles to create connections
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Use controls to zoom and fit view
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  Add new nodes with the button above
                </li>
              </ul>
            </Panel>
            </ReactFlow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
