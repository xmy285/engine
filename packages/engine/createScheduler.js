/**
 * Session 中包装着 Unit。
 * Session 表示的一次批量的 cnode 变更，例如某一个 dom 事件触发的所有 cnode 改变会在一个 session 中处理。
 * Unit 表示的是某一个 cnode 的变更。
 * 在 session 中再触发 collect 还有没有用？ 如果 lock 了就没用。
 * 现在的策略是：在 session 中 paint 阶段没 lock(为了支持在 willMount 中子组件 setState)，可以继续 collect。digest 阶段 lock 了。
 *
 * 在 react 中，有哪些生命周期可能再次引起变化？
 * didMount/didUpdate(都是在 digest 之后，所以是先收集，session 完成后再执行，不想出现 session 套 session 的情况)
 * didCatch(肯定是在 paint 的某一个 unit 中)
 *
 * willReceiveProps(static getDerivedStateFromProps) 根据 props 变化(要求能够判断是不是因为 props 引起的变化)
 * 这个应该是在 paint unit 开始之前，反正要 paint，所以有且仅有一次机会再改一下自己的 state。
 * 即使改了，也 collect 不进来，不用担心。
 *
 * getSnapshotBeforeUpdate() 在 digest 的 unit 之前，不能再 setState(正好也不能，因为 lock 了)。
 */
import { walkCnodes } from './common'
import { each } from './util'
import {
  SESSION_INITIAL,
  SESSION_UPDATE,
  UNIT_PAINT,
  UNIT_REPAINT,
  UNIT_INITIAL_DIGEST,
  UNIT_UPDATE_DIGEST, UNIT_PARTIAL_UPDATE_DIGEST,
} from './constant'
import createTrackingTree from './createTrackingTree'
import { invariant } from './util';



export default function createScheduler(painter, view, supervisor) {
  let ctree
  // trackingTree 的目的是解决 "先 collect 了父节点，后 collect了子节点，但父节点执行后，其实要 destroy 子节点"。
  // 还有可能 先 collect 了子节点，后 collect 了父节点，父节点在执行后又更新了子节点，子节点先更新的话就浪费资源了。
  const cnodeTrackingTree = createTrackingTree()
  const vnodeTrackingMap = new Map()
  let currentSession = null

  function startUpdateSession(potentialChangeTriggerFn) {
    invariant(!currentSession, `already in session ${currentSession}`)
    currentSession = SESSION_UPDATE
    // Expect scheduler api collectChangedCnodes will be used inside this function
    // to collect changed cnodes into tracking tree.
    try {
      potentialChangeTriggerFn && potentialChangeTriggerFn()
      // Collect finished
      if (!cnodeTrackingTree.isEmpty() || vnodeTrackingMap.size !== 0) {
        supervisor.session(SESSION_UPDATE, () => {

          cnodeTrackingTree.walk((cnode) => {
            const unit = cnode.isPainted ? UNIT_REPAINT : UNIT_PAINT
            supervisor.unit(SESSION_UPDATE, unit , cnode, () => {
              const paintMethod = cnode.isPainted ? painter.repaint : painter.paint
              const { toPaint = {}, toRepaint = {}, toDispose = {} } = supervisor.filterNext(paintMethod(cnode), cnode)
              each(toPaint, toPaintCnode => cnodeTrackingTree.track(toPaintCnode))
              each(toRepaint, toRepaintCnode => {
                cnodeTrackingTree.track(toRepaintCnode)
                vnodeTrackingMap.delete(toRepaintCnode)
              })
              each(toDispose, toDisposeCnode => {
                cnodeTrackingTree.dispose(toDisposeCnode, true)
                vnodeTrackingMap.delete(toDisposeCnode)
              })
            })
          })
          cnodeTrackingTree.lock()
          // 开始 cnode digest。cnodeTrackingTree.walk 第二参数会让自动删掉已经处理的节点。
          cnodeTrackingTree.walk((cnode) => {
            const unit = cnode.isDigested ? UNIT_UPDATE_DIGEST : UNIT_INITIAL_DIGEST
            supervisor.unit(SESSION_UPDATE, unit, cnode, () => {
              const digestMethod = cnode.isDigested ? view.updateDigest : view.initialDigest
              digestMethod(cnode)
            })
          }, true) // the second argument will consume the tree
          cnodeTrackingTree.unlock()

          // 开始处理局部 vnode 的更新
          vnodeTrackingMap.forEach((changedPatchNodes, cnode) => {
            changedPatchNodes.forEach(changedPatchNode => {
              supervisor.unit(SESSION_UPDATE, UNIT_PARTIAL_UPDATE_DIGEST, cnode, () => {
                // 第一参数表示根据什么去更新，可能会被外面劫持。所以最后还补了一个参数，外部可以动第一个，但不要动最后一个。
                view.updateElement(changedPatchNode, cnode, changedPatchNode)
              })
            })
            vnodeTrackingMap.delete(cnode)
          })

          // CAUTION 一定要放在这里才调用，这个时候才稳定。
          view.didMount()
        })
      }
    } catch(e) {
      console.error(e)
    } finally {
      currentSession = null
    }
  }

  function startInitialSession(vnode) {
    currentSession = SESSION_INITIAL
    supervisor.session(SESSION_INITIAL, () => {

      ctree = painter.createCnode({
        type: {
          displayName: 'ARE_ROOT',
          render: () => vnode,
        },
      })

      walkCnodes([ctree], (cnode) => {
        supervisor.unit(SESSION_INITIAL, UNIT_PAINT, cnode, () => {
          // initialize will create cnode.next, so walkCnode will go on.
          painter.paint(cnode)
        })
      })

      walkCnodes([ctree], (cnode) => {
        supervisor.unit(SESSION_INITIAL, UNIT_INITIAL_DIGEST, cnode, () => {
          view.initialDigest(cnode)
        })
      })

      // CAUTION 一定要放在这里才调用，这个时候子元素之类才都有了，才算稳定。
      view.didMount()
    })

    currentSession = null
    return ctree
  }

  return {
    startInitialSession,
    startUpdateSession,
    collectChangedCnodes: cnodes => {
      cnodes.forEach(cnode => cnodeTrackingTree.track(cnode))
      if (!currentSession) {
        startUpdateSession()
      }
    },
    collectChangePatchNode: (vnodesIndexedByCnode) => {
      // CAUTION 这里不要去动原来的对象
      vnodesIndexedByCnode.forEach((vnodes, cnode) => {
        let trackedVnodes = vnodeTrackingMap.get(cnode)
        if (!trackedVnodes) vnodeTrackingMap.set(cnode, (trackedVnodes = new Set()))
        vnodes.forEach(vnode => trackedVnodes.add(vnode))
      })
      if (!currentSession) {
        startUpdateSession()
      }
    },
    getCurrentSession: () => currentSession
  }
}
