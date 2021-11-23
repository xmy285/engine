// 以ER为例, 一个节点必备的元素
import { Axii, IBBox } from './basicTypes';
import { K6Port } from './Port';

// 渲染方式，原始 或 Axii Component
enum ENodeViewMode {
  axii = 'axii',
  htlm = 'html',
}
// 节点的名称c
type INodeShape = string;

/** 
 * 给组件的props 或者是schema模式
 * 为什么不schema？因为scehma已经是历史了，虽然schema DSL抽象能力更强，但是有额外成本。
 * 维护成本，职责定位跟ts的类型声明有重合，而且没法跟ts类型自动维护
 * 学习成本，有额外的维护和学习成本
**/
export interface INodeViewProps {
  [key: string]: any;
}

/**
 * layout模式
 * 默认不指定的情况下是根据node.x.y的绝对定位
 * 指定的情况下可以是根据相关Layout（这让我想起了安卓的xml
 * 
 * layout应该顶部全局注入
 */
interface ILayout {
  Absolute: Axii.Component;
  Other: Axii.Component;
}

export interface ITopState {
  [key: string]: any;
}

// -------
export abstract class K6Node {
  data: ITopState;
  abstract shape: INodeShape;
  bbox: IBBox = { x: 10, y: 10 };
  ports: K6Port[] = [];
  size: number[] = [0, 0];

  constructor () {

  }
  
  setSize(args: { width:number, height:number }) {
    console.log('args: ', args);
    this.size = [args.width, args.height];
  }

  abstract getComponent(data?: INodeViewProps): Axii.Component;
}
export const DEFAULT_SHAPE = 'enitity-shape';
export class K6NodeChild extends K6Node {
  shape = DEFAULT_SHAPE;
  getComponent() {
  }
}