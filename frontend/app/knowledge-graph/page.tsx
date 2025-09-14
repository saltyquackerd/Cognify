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
  ReactFlowInstance,
} from 'reactflow';
import { API_URLS } from '../../lib/api';

// Elegant node component with sophisticated styling and typography
const CustomNode = ({ data }: { data: { label: string; color?: string; textColor?: string; size?: number; gradient?: string } }) => {
  // Calculate dynamic size based on text content with better spacing
  const text = data.label || '';
  const words = text.split(' ');
  const maxWordLength = Math.max(...words.map((word: string) => word.length));
  const wordCount = words.length;
  
  // Calculate optimal rectangle size with better proportions
  const baseWidth = Math.max(120, Math.min(200, maxWordLength * 10 + 40));
  const width = wordCount > 1 ? baseWidth + 20 : baseWidth;
  const height = wordCount > 2 ? 64 : wordCount > 1 ? 56 : 48;
  
  return (
    <div 
      className="relative flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer group"
      style={{ 
        width: width,
        height: height,
        borderRadius: '20px',
        background: data.gradient || 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: data.textColor || '#475569',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.08),
          0 4px 16px rgba(0, 0, 0, 0.04),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Subtle inner glow effect */}
      <div 
        className="absolute inset-0 rounded-[20px] opacity-30"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
        }}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 !bg-white !border-2 !border-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm"
        style={{ left: -8 }}
      />
      
      <div 
        className="relative text-center px-4 py-2 z-10"
        style={{ 
          maxWidth: `${width - 24}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          lineHeight: '1.3'
        }}
      >
        <div 
          className="font-medium break-words whitespace-normal leading-relaxed"
          style={{
            fontSize: wordCount > 2 ? '13px' : wordCount > 1 ? '14px' : '15px',
            fontWeight: '500',
            letterSpacing: '0.025em',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}
        >
          {data.label}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 !bg-white !border-2 !border-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm"
        style={{ right: -8 }}
      />
      
      {/* Subtle hover effect overlay */}
      <div 
        className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
        }}
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

// Elegant pastel color palette with soft, harmonious colors
const getNodeColor = (topic: string): { gradient: string; textColor: string } => {
  const colorSchemes = [
    { gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', textColor: '#475569' },
    { gradient: 'linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%)', textColor: '#7c3aed' },
    { gradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', textColor: '#059669' },
    { gradient: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', textColor: '#d97706' },
    { gradient: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)', textColor: '#dc2626' },
    { gradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', textColor: '#0284c7' },
    { gradient: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', textColor: '#9333ea' },
    { gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', textColor: '#16a34a' },
    { gradient: 'linear-gradient(135deg, #fef7ff 0%, #fce7f3 100%)', textColor: '#be185d' },
    { gradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', textColor: '#64748b' }
  ];
  
  // Use topic name to consistently assign colors
  const hash = topic.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return colorSchemes[Math.abs(hash) % colorSchemes.length];
};

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  // Ensure component is mounted on client side
  useEffect(() => {
    setMounted(true);
    if (process.env.NODE_ENV === 'development') {
      console.log('Component mounted, React Flow should be interactive now');
    }
  }, []);

  // Additional effect to ensure React Flow is properly initialized
  useEffect(() => {
    if (mounted) {
      if (process.env.NODE_ENV === 'development') {
        console.log('React Flow should be fully initialized now');
      }
      // Force a re-render to ensure React Flow is properly mounted
      setTimeout(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('React Flow initialization complete');
          if (reactFlowRef.current) {
            console.log('React Flow ref is set:', reactFlowRef.current);
          } else {
            console.log('React Flow ref is not set');
          }
        }
      }, 100);
    }
  }, [mounted]);

  // Load knowledge graph data
  useEffect(() => {
    if (!mounted) return; // Only load data after component is mounted
    
    if (process.env.NODE_ENV === 'development') {
      console.log('KnowledgeGraphPage mounted, React Flow should be interactive');
      console.log('Current nodes:', nodes);
      console.log('Current edges:', edges);
    }
    const loadKnowledgeGraph = async () => {
      try {
        setError(null);
        setLoading(true);
        
        // Call your backend API endpoint
        const response = await fetch(API_URLS.KNOWLEDGE_GRAPH());
        
        if (!response.ok) {
          throw new Error(`Failed to fetch knowledge graph data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log('Knowledge graph API response:', data);
          console.log('Topics from API:', data.topics);
          console.log('Edges from API:', data.edges);
        }
        
        // Transform API data to React Flow format
        // Backend returns: { topics: [...], edges: [[source, target], ...] }
        const topics = data.topics || ['Test Node 1', 'Test Node 2', 'Test Node 3'];
        const edgeList = data.edges || [['Test Node 1', 'Test Node 2'], ['Test Node 2', 'Test Node 3']];
        
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Processed topics:', topics);
          console.log('Processed edges:', edgeList);
          console.log('Topics length:', topics.length);
          console.log('EdgeList length:', edgeList.length);
        }
        
        // Calculate node degrees (number of connections)
        const nodeDegrees = new Map<string, number>();
        topics.forEach((topic: string) => nodeDegrees.set(topic, 0));
        edgeList.forEach(([source, target]: [string, string]) => {
          nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
          nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
        });

        // Create nodes with web-like positioning using force simulation
        if (process.env.NODE_ENV === 'development') {
          console.log('Creating nodes for topics:', topics);
        }
        const transformedNodes = topics.map((topic: string, index: number) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Creating node ${index}: ${topic}`);
          }
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
            type: 'customNode', // Use customNode consistently
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
        
        if (process.env.NODE_ENV === 'development') {
          console.log('All nodes created:', transformedNodes.length);
          console.log('Node IDs:', transformedNodes.map((n: Node) => n.id));
        }
        
        
        // Create edges from edge list with web-like styling
        const transformedEdges = edgeList.map((edge: [string, string], index: number) => {
          const sourceDegree = nodeDegrees.get(edge[0]) || 0;
          const targetDegree = nodeDegrees.get(edge[1]) || 0;
          const edgeStrength = Math.min(sourceDegree, targetDegree);
          
          // Use consistent edge styling for better visibility
          const strokeWidth = Math.max(1.5, Math.min(3, 1.5 + edgeStrength * 0.2));
          
          // Use smooth curved edges with elegant styling
          const edgeType = 'smoothstep';
          
          return {
            id: `edge-${index}`,
            source: edge[0],
            target: edge[1],
            type: edgeType,
            animated: false,
            style: {
              stroke: '#94a3b8',
              strokeWidth: 2.5,
              opacity: 0.7
            }
          };
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Setting nodes:', transformedNodes);
          console.log('Setting edges:', transformedEdges);
          console.log('Transformed nodes length:', transformedNodes.length);
          console.log('Transformed edges length:', transformedEdges.length);
        }
        setNodes(transformedNodes);
        setEdges(transformedEdges);
        
        // Force fit view after a short delay to ensure React Flow is ready
        setTimeout(() => {
          if (reactFlowRef.current && typeof reactFlowRef.current.fitView === 'function') {
            reactFlowRef.current.fitView({ padding: 0.1 });
            if (process.env.NODE_ENV === 'development') {
              console.log('Fit view called');
            }
          }
        }, 100);
        
        
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
        setError(error instanceof Error ? error.message : 'Failed to load knowledge graph');
        
        // Fallback to sample data if API fails
        const fallbackNodes: Node[] = [
          {
            id: 'ai',
            type: 'customNode',
            position: { x: 300, y: 200 },
            data: { 
              label: 'AI', 
              gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              textColor: '#475569',
              category: 'Core Concept',
              originalGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              originalTextColor: '#475569'
            }
          },
          {
            id: 'ml',
            type: 'customNode',
            position: { x: 500, y: 200 },
            data: { 
              label: 'ML', 
              gradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
              textColor: '#059669',
              category: 'Technology',
              originalGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
              originalTextColor: '#059669'
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
            animated: false,
            style: { 
              stroke: '#94a3b8', 
              strokeWidth: 2.5, 
              opacity: 0.7
            }
          }
        ];
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Using fallback data - nodes:', fallbackNodes);
          console.log('Using fallback data - edges:', fallbackEdges);
        }
        setNodes(fallbackNodes);
        setEdges(fallbackEdges);
        
        // Force fit view for fallback data too
        setTimeout(() => {
          if (reactFlowRef.current && typeof reactFlowRef.current.fitView === 'function') {
            reactFlowRef.current.fitView({ padding: 0.1 });
            if (process.env.NODE_ENV === 'development') {
              console.log('Fit view called for fallback data');
            }
          }
        }, 100);
      } finally {
        setLoading(false);
      }
    };
    
    loadKnowledgeGraph();
  }, [mounted, setNodes, setEdges]);

  // Debug effect to track nodes and edges changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Nodes changed:', nodes);
      console.log('Edges changed:', edges);
      console.log('React Flow should render with', nodes.length, 'nodes and', edges.length, 'edges');
    }
  }, [nodes, edges]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Connection created:', params);
      }
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Handle node selection and highlighting
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Node clicked:', node.id);
    }
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
    
    // Update nodes with highlighting (keep original gradients, enhance selected nodes)
    setNodes(currentNodes => 
      currentNodes.map(n => {
        const isSelected = n.id === node.id;
        const isConnected = connectedNodeIds.has(n.id);
        
        return {
          ...n,
          data: {
            ...n.data,
            gradient: n.data.originalGradient, // Keep original gradients
            textColor: n.data.originalTextColor // Keep original text color
          },
          style: {
            opacity: isSelected || isConnected ? 1 : 0.4,
            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isSelected 
              ? '0 12px 40px rgba(0, 0, 0, 0.15), 0 6px 20px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 8px 32px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }
        };
      })
    );
    
    // Update edges with highlighting
    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        style: {
          ...e.style,
          stroke: connectedEdgeIds.has(e.id) ? '#6366f1' : '#94a3b8',
          strokeWidth: connectedEdgeIds.has(e.id) ? 3 : 2.5,
          opacity: connectedEdgeIds.has(e.id) ? 1 : 0.5,
          filter: connectedEdgeIds.has(e.id) ? 'drop-shadow(0 4px 8px rgba(99, 102, 241, 0.3))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
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
          opacity: 1,
          transform: 'scale(1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }
      }))
    );
    
    // Reset all edges to original styles
    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        style: {
          ...e.style,
          stroke: '#94a3b8',
          strokeWidth: 2.5,
          opacity: 0.7,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
        }
      }))
    );
  }, [setNodes, setEdges]);

  // Initialize React Flow instance
  const onInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    reactFlowRef.current = reactFlowInstance;
  }, []);

  // Handle adding new nodes
  const onAddNode = useCallback(() => {
    const colorScheme = getNodeColor('New Concept');
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'customNode',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <style jsx global>{`
        .react-flow__node {
          border: none !important;
          outline: none !important;
        }
        .react-flow__node-default {
          border: none !important;
          outline: none !important;
        }
        .react-flow__node-customNode {
          border: none !important;
          outline: none !important;
        }
        .react-flow__node-rect {
          border: none !important;
          outline: none !important;
        }
        .react-flow__node input {
          border: none !important;
          outline: none !important;
        }
        .react-flow__edge-path {
          stroke: #94a3b8 !important;
          stroke-width: 2.5 !important;
          opacity: 0.7 !important;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #6366f1 !important;
          stroke-width: 3 !important;
          opacity: 1 !important;
        }
        .react-flow__controls {
          background: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(203, 213, 225, 0.3) !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
        }
        .react-flow__minimap {
          background: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(203, 213, 225, 0.3) !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
        }
      `}</style>
      {/* Elegant Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-6 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.back()}
              className="p-3 hover:bg-slate-100/80 rounded-xl transition-all duration-200 group"
            >
              <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-light text-slate-800 tracking-tight">
                Knowledge Graph
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">Interactive concept visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onAddNode}
              className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Concept
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <div className="h-[calc(100vh-96px)]">
        {/* React Flow Area */}
        <div className="h-full relative" style={{ minHeight: '600px' }}>
          {/* Elegant background pattern */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: `
                radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)
              `
            }}
          />
          
          {/* Elegant Statistics Overlay */}
          <div className="absolute top-6 left-6 z-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50 shadow-xl">
              <h3 className="text-xl font-light text-slate-700 mb-4 flex items-center gap-3">
                <div className="w-3 h-3 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
                Graph Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Concepts:</span>
                  <span className="text-xl font-light text-slate-700">{nodes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Connections:</span>
                  <span className="text-xl font-light text-slate-700">{edges.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Density:</span>
                  <span className="text-xl font-light text-slate-700">
                    {nodes.length > 1 ? ((edges.length / (nodes.length * (nodes.length - 1))) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          {!mounted && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-indigo-500 mx-auto mb-6"></div>
                <p className="text-slate-600 font-light text-lg">Loading interactive graph...</p>
              </div>
            </div>
          )}
          {mounted && error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="bg-white/90 backdrop-blur-xl border border-red-200/50 rounded-2xl p-8 shadow-xl">
                  <div className="flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mx-auto mb-6">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-light text-red-800 mb-3">Unable to Load Graph</h3>
                  <p className="text-red-600 mb-6 font-light">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
          {mounted && !error && (
            <div>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={onInit}
                nodeTypes={nodeTypes}
                fitView
                className="bg-transparent"
                style={{ width: '100%', height: '100%', minHeight: '500px' }}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              >
            <Controls className="!bg-white/90 !backdrop-blur-xl !border !border-slate-200/50 !rounded-2xl !shadow-xl" />
            <MiniMap 
              className="!bg-white/90 !backdrop-blur-xl !border !border-slate-200/50 !rounded-2xl !shadow-xl"
              nodeColor={(node) => node.data?.gradient || node.data?.color || '#6366f1'}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={40} 
              size={1.5}
              color="#cbd5e1"
            />
            
            {/* Elegant Instructions Panel */}
            <Panel position="top-right" className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-8 shadow-xl max-w-sm">
              <h4 className="text-xl font-light text-slate-700 mb-6 flex items-center gap-3">
                <div className="w-3 h-3 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
                How to Use
              </h4>
              <ul className="text-sm text-slate-600 space-y-4 font-light">
                <li className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                  <span>Drag concepts to reposition them</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                  <span>Click concepts to explore connections</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                  <span>Drag from handles to create links</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                  <span>Use controls to zoom and navigate</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                  <span>Add new concepts with the button above</span>
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
