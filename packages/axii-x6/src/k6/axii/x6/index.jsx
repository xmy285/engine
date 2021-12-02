/** @jsx createElement */
import { createFlowGraph } from './graph';
import { Graph as X6Graph, Markup } from '@antv/x6'
import lodash, { pick } from 'lodash';
import {
  tryToRaw,
  createElement,
  render,
  useRef,
  watch,
  traverse,
  useViewEffect,
} from "axii";
import { DEFAULT_SHAPE } from '../../Node';

export const Register = {
  htmlComponentMap: new Map(),
  registerHTMLComponent(name, func) {
    if (!this.htmlComponentMap.get(name)) {
      this.htmlComponentMap.set(name, func);
      X6Graph.registerHTMLComponent(name, func);
    } else {
      console.warn(`${name} has already register`);
    }
  },
  registerHTMLComponentRender({ getInject }) {
    return (node) => {
      const [graph, dm, myNode, myPort, myEdge] = getInject();
      const wrap = document.createElement('div')
      // nodeConfig is reactive
      const nodeConfig = dm.findNode(node.id);
      
      const Cpt = myNode.getComponent(nodeConfig);
      render(<Cpt {...nodeConfig} globalData={myNode.data} />, wrap);

      function refreshNodeSize(){
        const { width, height } = (wrap.children[0].getBoundingClientRect());
        node.setProp({ width, height });
        myNode.setSize({ width, height });

        // render port
        const portConfigArr = myPort.getConfig(nodeConfig.id);
        console.log('portConfigArr: ', portConfigArr);
        const ports = {
          groups: portConfigArr.map((portConfig, index) => {
            const { portId, position, size } = portConfig;
            return {
              [`${portId}${index}`]: {
                position: [position.x, position.y],
                attrs: {
                  fo: {
                    width: size.width,
                    height: size.height,
                    magnet: true,
                  }
                }
              }
            };
          }).reduce((p, n) => Object.assign(p, n), {}),
          items: portConfigArr.map((portConfig, index) => {
            const { portId, position } = portConfig;
            return {
              id: portId,
              group: `${portId}${index}`,
              position,
            };
          }),
        };
        node.setProp('ports', ports);
        // render edge
        requestAnimationFrame(() => {
          nodeConfig.edges.forEach(edge => {
            const edgeConfig = myEdge.getConfig(nodeConfig, edge);
            const edgeIns = graph.addEdge({
              ...edgeConfig,
            });
        });
        });
      }

      watch(() => traverse(nodeConfig.data), () => {
        // @TODO:依赖myNode的axii渲染完成之后的动作，先加延时解决
        setTimeout(() => {
          refreshNodeSize();
        }, 25);
      });

      setTimeout(() => {
        refreshNodeSize();

      }, 50);

      return wrap;
    }
  },
  registerPortRender({ dm }) {
    return args => {
      const node = args.node;
      const originNode = dm.findNode(node.id);
      const nodeComponent = dm.getShapeComponent(originNode.shape);
  
      const selectors = args.contentSelectors
      const container = selectors && selectors.foContent
      if (container) {
        const portInst = nodeComponent[1];
        const Cpt = portInst.getComponent(originNode);
        render(createElement(Cpt, { ...originNode, data: portInst.data }), container);
      }  
    }
  },
};

export const Graph = {
  graph: null,

  dm: null,

  getHtmlKey(n) {
    const registerKey = `${n || DEFAULT_SHAPE}-html`;
    return registerKey;
  },

  init(container, dm, config) {
    const graph = createFlowGraph(container, {
      ...config, 
      onPortRendered: Register.registerPortRender({
        dm,
      }),
      onAddEdge(nodeId, edgeId) {
        dm.addNewEdge(nodeId,edgeId);
      },
    });

    const allShapeComponents = dm.getAllShapeComponents();

    allShapeComponents.forEach(([myNode, myPort, myEdge]) => {
      const shape = myNode.shape;
      const registerKey = this.getHtmlKey(shape);
      Register.registerHTMLComponent(registerKey, Register.registerHTMLComponentRender({
        // 运行时动态获取，防止泄露
        getInject: () => {
          return [
            this.graph,
            this.dm,
            ...this.dm.nodeShapeComponentMap.get(shape),
          ];
        },
      }));  
    });

    graph.on('cell:click', ({ cell }) => {
      if (cell.isNode()) {
        dm.selectNode(cell.id);
      } else if (cell.isEdge()) {
        dm.selectEdge(cell.id);
      }
    });
    graph.on('blank:click', (arg) => {      
      dm.selectNode();
    });


    dm.on('remove', (id) => {
      graph.removeCell(id);
    });
    dm.on('zoom-in', (v) => {
      graph.zoom(v);
      console.log('graph.zoom(): ', graph.zoom());
    });
    dm.on('zoom-out', (v) => {
      graph.zoom(-v);
      console.log('graph.zoom(): ', graph.zoom());
    });
    dm.on('addNode', (n) => {
      this.addNode(n);
    });

    this.graph = graph;
    this.dm = dm;
  },

  renderNodes(nodes) {
    nodes.forEach(node => {
      this.addNode(tryToRaw(node));      
    });
  },

  addNode(nodeConfig) {
    const htmlKey = this.getHtmlKey(nodeConfig.shape);

    const nodeConfigView = nodeConfig.view;
    delete nodeConfig.view;

    const node = lodash.merge({
      ...nodeConfigView,
    }, nodeConfig, {
      shape: 'html',
      portMarkup: [ Markup.getForeignObjectMarkup() ],
      attrs: {
        rect: {
          fill: '#fff',
          stroke: '#000',
        },
      },
      html: htmlKey,
      ports: {},      
    });

    const x6NodeInstance = this.graph.addNode(node);
  },
  exportData() {
    return this.graph.toJSON();
  },
  getNodePosition(id) {
    const allNodes = this.graph.model.getNodes();
    const targetNode = allNodes.find(n => n.id === id);
    if (targetNode) {
      return targetNode.position();
    }
  },
  updateEdge(edge, newEdgeConfig) {
    const allEdges = this.graph.model.getEdges();
    const edgeIns = allEdges.find(e => e.id === edge.id);
    edgeIns.setLabels(newEdgeConfig.label || '');
    return pick(edgeIns, ['id', 'target', 'source', 'label', 'name', 'type']);
  },
  dispose() {
    const { graph } = this;
    graph.removeCells(graph.getCells());
    graph.getEdges().forEach(e => graph.removeEdge(e));
    graph.dispose();
  }
}


export const Connect = {
  transformNode(nodeConfig, [NodeCls, PortCls, EdgeCls]) {

  }
};


export const Data = {
  readNodes(nodeConfigArr) {
    
  }
}