const fetch = require('node-fetch')
const { Client, Config, CheckoutAPI } = require('@adyen/api-library')
const { serializeError } = require('serialize-error')
const configLoader = require('../config/config')

const env = configLoader.load()
const config = new Config()

config.apiKey = env.adyen.apiKey
config.merchantAccount = env.adyen.merchantAccount

const client = new Client({ config })
client.setEnvironment("TEST") // TODO: take it as environment var

const checkout = new CheckoutAPI(client);

function getOriginKeys (getOriginKeysRequestObj) {
  return callAdyen(`${config.adyen.apiBaseUrl}/originKeys`, getOriginKeysRequestObj)
}

async function getPaymentMethods (request) {
  request.merchantAccount = env.adyen.merchantAccount
  const response = await checkout.paymentMethods(getPaymentMethodsRequestObj)
    .then(res => res)
    .then(res => {
      // strip away sensitive data from the adyen response.
      delete res.additionalData
      return res
    })
    .catch(err => serializeError(err))

  return { request, response }
}

async function makePayment (request) {
  request.merchantAccount = env.adyen.merchantAccount
  return await checkout.payments(makePaymentRequestObj)
    .then(res => res)
    .then(res => {
      // strip away sensitive data from the adyen response.
      delete res.additionalData
      return res
    })
    .catch(err => serializeError(err))


  return { request, response }
}

function submitAdditionalPaymentDetails (submitAdditionalPaymentDetailsRequestObj) {
  return callAdyen(`${config.adyen.apiBaseUrl}/payments/details`, submitAdditionalPaymentDetailsRequestObj)
}

function cancelOrRefund (cancelOrRefundRequestObj) {
  return callAdyen(`${config.adyen.legacyApiBaseUrl}/cancelOrRefund`, cancelOrRefundRequestObj)
}

function manualCapture (manualCaptureRequestObj) {
  return callAdyen(`${config.adyen.legacyApiBaseUrl}/capture`, manualCaptureRequestObj)
}

async function callAdyen (url, request) {
  let response
  try {
    response = await fetchAsync(url, request)
  } catch (err) {
    response = serializeError(err)
  }
  return { request, response }
}

async function fetchAsync (url, requestObj) {
  const request = buildRequest(requestObj)
  const response = await fetch(url, request)
  const responseBody = await response.json()
  // strip away sensitive data from the adyen response.
  delete responseBody.additionalData
  return responseBody
}

function buildRequest (requestObj) {
  // ensure the merchantAccount is set with request, otherwise set.
  if (!requestObj.merchantAccount)
    requestObj.merchantAccount = config.adyen.merchantAccount

  return {
    method: 'POST',
    body: JSON.stringify(requestObj),
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.adyen.apiKey
    }
  }
}

module.exports = {
  getOriginKeys,
  getPaymentMethods,
  makePayment,
  submitAdditionalPaymentDetails,
  cancelOrRefund,
  manualCapture
}
