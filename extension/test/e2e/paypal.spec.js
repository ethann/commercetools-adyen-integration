const puppeteer = require('puppeteer')
const _ = require('lodash')
const url = require('url')
const { expect } = require('chai')

const { routes } = require('../../src/routes')
const iTSetUp = require('../integration/integration-test-set-up')
const ctpClientBuilder = require('../../src/ctp/ctp-client')
const paymentTemplate = require('../fixtures/payment-paypal.json')
const utils = require('../../src/utils')

let browser
let page
let ctpClient

before(async () => {
  routes['/paypal-return-url'] = async (request, response) => {
    const { payload, interfaceId } = url.parse(request.url, { parseQueryString: true }).query
    const uri = ctpClient.builder.payments
    const actions = [{
      action: 'setCustomField',
      name: 'payload',
      value: payload
    }]
    const query = `interfaceId="${interfaceId}"`
    const { body: { results: [paymentObject] } } = await ctpClient.fetch(ctpClient.builder.payments.where(query))
    await ctpClient.update(uri, paymentObject.id, paymentObject.version, actions)
    utils.sendResponse({ response })
  }
  ctpClient = ctpClientBuilder.get()
  await iTSetUp.initServerAndExtension({ ctpClient, routes })
  browser = await puppeteer.launch({ headless: false })
  page = await browser.newPage()
})

after(async () => {
  // await browser.close()
  await iTSetUp.cleanupResources(ctpClient)
})

describe('Paypal', function () {
  it('should finish the payment process', async function () {
    this.timeout(300000)

    const paymentDraft = _.template(JSON.stringify(paymentTemplate))({
      returnUrl: `${process.env.API_EXTENSION_BASE_URL}/paypal-return-url?interfaceId=${paymentTemplate.interfaceId}`
    })
    const { body } = await ctpClient.create(ctpClient.builder.payments, paymentDraft)

    const { redirectUrl } = body.custom.fields
    await page.goto(`file://${__dirname}/paypal-page.html`)
    await page.$eval('[data-e2e="paypalLink"]', (el, urlParam) => el.setAttribute('href', urlParam), redirectUrl)
    await Promise.all([
      page.click('[data-e2e="paypalLink"]'),
      page.waitForNavigation()
    ])
    await page.type('#email', 'email@paypal.com')
    await page.type('#password', 'password')
    await page.click('#btnNext')
    await page.waitForSelector('#splitPassword:not(.invisible)')
    await page.click('#btnLogin')
    await page.waitForSelector('#confirmButtonTop')
    await Promise.all([
      await page.click('#confirmButtonTop'),
      page.waitForNavigation()
    ])

    const query = `interfaceId="${paymentTemplate.interfaceId}"`
    const { body: { results: [paymentObject] } } = await ctpClient.fetch(ctpClient.builder.payments.where(query))
    expect(paymentObject).is.not.empty
  })
})
