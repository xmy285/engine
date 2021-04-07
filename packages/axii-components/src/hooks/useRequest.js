import axios  from 'axios'
import { ref, debounceComputed, watch, traverse } from 'axii'

export function createUseRequest(instance, { createReactiveData = () => ({}), processResponse = () => {}, processError = () => {} } = {}) {
	return function useRequest(inputConfig, { manual, deps } = {}) {

		let doRequest
		if (typeof inputConfig === 'function') {
			doRequest = inputConfig
		} else {
			const config = typeof inputConfig === 'string' ? { url: inputConfig } : inputConfig
			doRequest = () => instance(Object.assign({}, config, argv))
		}

		const data = ref()
		const error = ref()
		const status = ref()
		const loading = ref()
		const useData = createReactiveData()

		const values = {
			data,
			error,
			status,
			loading,
			...useData
		}

		let runId = 0
		function run(...argv) {
			const currentRunId = ++runId

			loading.value = true
			error.value = null
			status.value = undefined

			doRequest(...argv).then(response => {
				if (currentRunId !== runId) return
				debounceComputed(() => {
					data.value = response.data
					status.value = response.status
					processResponse(values, response)
				})
			}).catch((error) => {
				if (currentRunId !== runId) return

				console.error(error)
				debounceComputed(() => {
					data.value = undefined

					if (error.response) {
						// The request was made and the server responded with a status code
						// that falls out of the range of 2xx
						error.value = error.response.data
						status.value = error.response.status
					} else if (error.request) {
						// The request was made but no response was received
						// `error.request` is an instance of XMLHttpRequest in the browser and an instance of
						// http.ClientRequest in node.js
						error.value = 'no response'
					} else {
						// Something happened in setting up the request that triggered an Error
						error.value = 'client error'
					}

					processError(values, error)
				})
			}).finally(() => {
				if (currentRunId !== runId) return

				loading.value = false
			})
		}


		if (!manual) run()
		if (deps) {
			watch(() => deps.forEach(dep => traverse(dep)), run)
		}

		return {
			...values,
			run,
		}
	}
}

export default createUseRequest(axios)
