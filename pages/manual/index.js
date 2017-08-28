import React from 'react'
import ReactDom from 'react-dom'
import connect from '@cicada/render/lib/connect'
import { mapValues } from '@cicada/render/lib/util'
import Render from '@cicada/render/lib/Render'
import createStateTree from '@cicada/render/lib/createStateTree'
import createAppearance from '@cicada/render/lib/createAppearance'
import applyStateTreeSubscriber from '@cicada/render/lib/applyStateTreeSubscriber'
import createBackground from '@cicada/render/lib/createBackground'
import * as listenerBackground from '@cicada/render/lib/background/utility/listener'

import * as Input from './Input'
import * as Checkbox from './Checkbox'
import * as Repeat from './Repeat'
import * as Button from './Button'

const C = mapValues({ Input, Checkbox, Repeat, Button }, connect)

let globalKey = 0
function createUniqueKey() {
  return String(globalKey++)
}

const stateTree = applyStateTreeSubscriber(createStateTree)()
const appearance = createAppearance()

window.stateTree = stateTree

function addOne({ stateTree: innerStateTree }) {
  const items = innerStateTree.get('repeat.items').slice()
  items.push({ key: createUniqueKey() })
  stateTree.merge('repeat.items', items)
}

function removeOne({ stateTree: innerStateTree, state }) {
  const items = innerStateTree.get('repeat.items').slice()
  const nextItems = items.filter(item => item.btn !== state)
  innerStateTree.merge('repeat.items', nextItems)
}

ReactDom.render(
  <Render
    stateTree={stateTree}
    appearance={appearance}
    background={createBackground({
      utilities: {
        listener: listenerBackground,
      },
    })}
  >
    <div>
      <h1>普通 Input</h1>
      <C.Input bind="name" initialState={{ label: 'name' }} />
      <C.Input bind="age" initialState={{ label: 'age' }} />
    </div>
    <div>
      <h1>Repeat 中的 Input</h1>
      <C.Repeat bind="repeat">
        <C.Input bind="name" initialState={{ label: 'name' }} />
        <C.Input bind="age" initialState={{ label: 'age' }} />
        <C.Button initialState={{ text: '删除此项' }} bind="btn" listeners={{ onClick: { fns: [{ fn: removeOne }] } }} />
      </C.Repeat>
      <C.Button initialState={{ text: '添加' }} listeners={{ onClick: { fns: [{ fn: addOne }] } }} />
    </div>
    <div>
      <h1>Input with identifier</h1>
      <C.Input >
        <C.Input.Prefix><span>this is prefix</span></C.Input.Prefix>
      </C.Input>
    </div>
  </Render>,
  document.getElementById('root'),
)
