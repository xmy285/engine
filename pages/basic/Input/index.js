import React from 'react'
import PropTypes from 'prop-types'
import { Children } from '@cicada/render/lib/lego'
import { Input } from 'antd'
import { Interface } from '@cicada/render/lib/background/utility/form'
import { pick, zip, compose } from '../util'

import {
  noop,
  keep,
  createFormItem,
  SIZES,
  COMMON_INPUT_EVENT,
  COMMON_FORM_ITEM_STATE_TYPES,
  createFormItemDefaultState,
} from '../common'

const Search = Input.Search

export const implement = [Interface.item]

/*
 props
 */
export const getDefaultState = () => ({
  ...createFormItemDefaultState(),
  value: '',
  placeholder: '',
  size: SIZES[0],
  disabled: false,
  readOnly: false,
  search: false,
  type: 'text',
})

export const stateTypes = {
  ...COMMON_FORM_ITEM_STATE_TYPES,
  value: PropTypes.string,
  placeholder: PropTypes.string,
  size: PropTypes.oneOf(SIZES),
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  search: PropTypes.bool,
  type: PropTypes.string,
}

/*
 reduce functions
 */
export const defaultListeners = {
  ...zip(COMMON_INPUT_EVENT, new Array(COMMON_INPUT_EVENT.length).fill(noop)),
  onChange(_, e) {
    return {
      value: e.target.value,
    }
  },
  onPressEnter: keep,
  onSearch: keep,
}


/*
 identifier
 */
export const identifiers = {
  Prefix: {},
  Suffix: {},
}

/*
 render
 */
export function render({ state, listeners, children }) {
  const prefix = compose(Children.find, Children.hasChildren)(children, identifiers.Prefix) ? (
    Children.findChildren(children, identifiers.Prefix)[0]
  ) : null

  const suffix = compose(Children.find, Children.hasChildren)(children, identifiers.Suffix) ? (
    Children.findChildren(children, identifiers.Suffix)[0]
  ) : null

  const inputProps = pick(state, ['value', 'disabled', 'size', 'placeholder', 'readOnly', 'type'])
  const Component = state.search === true ? Search : Input

  const style = {
    width: '100%',
  }

  return createFormItem(
    state,
    <Component style={style} {...inputProps} addonBefore={prefix} addonAfter={suffix} {...listeners} />,
  )
}
