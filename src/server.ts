import { WebhookClient, MessageEmbed } from 'discord.js'
import express from 'express'
import { config } from './config'
import { chunk, NETWORK_COLOR, networks } from './util'
import { createIntentHandler, createWebsubMiddleware } from './middleware'

const port = process.env.PORT || 4000

const webhookClient = new WebhookClient({
  id: config.id,
  token: config.token,
})

const websubMiddleware = createWebsubMiddleware({
  secret: config.websubSecret,
})

const intentHandler = createIntentHandler({
  secret: config.websubSecret,
})

const app = express()
app.use(express.json())

app.get('/callback/locks', intentHandler)
app.get('/callback/keys', intentHandler)

app.post('/callback/locks', websubMiddleware, async (req) => {
  const embeds: MessageEmbed[] = []
  const locks: any[] = req.body?.data
  const network = networks[req.body?.network]
  const lockIds = locks.map((lock: any) => lock.id)

  console.info(`New Locks: ${lockIds.join(', ')}`)

  if (!locks.length) {
    return
  }

  for (const lock of locks) {
    const embed = new MessageEmbed()
    if (network) {
      embed.addField('network', network.name)

      const explorerURL = network.explorer.urls.address(lock.address)
      if (explorerURL) {
        embed.setURL(explorerURL)
      }
      const networkColor = NETWORK_COLOR[network.id]
      if (networkColor) {
        embed.setColor(networkColor)
      }
    }

    embed.setTitle(`New Lock (${lock.id})`)
    embeds.push(embed)
  }
  const embedChunks = chunk(embeds, 3)

  for (const embedChunk of embedChunks) {
    await webhookClient.send({
      embeds: embedChunk,
    })
  }
})

app.post('/callback/keys', websubMiddleware, async (req) => {
  const embeds: MessageEmbed[] = []
  const keys: any[] = req.body?.data
  const network = networks[req.body?.network]
  const keyIds = keys.map((key: any) => key.id)
  console.info(`New Keys: ${keyIds.join(', ')}`)
  if (!keys.length) {
    return
  }

  for (const key of keys) {
    const embed = new MessageEmbed()
    if (network) {
      embed.addField('network', network.name)

      const explorerURL = network.explorer.urls.address(key.lock.address)
      if (explorerURL) {
        embed.setURL(explorerURL)
      }

      const networkColor = NETWORK_COLOR[network.id]
      if (networkColor) {
        embed.setColor(networkColor)
      }
    }

    embed.setTitle(`New key (${key.id})`)
    embed.addField('lock', key.lock.address)
    embeds.push(embed)
  }
  const embedChunks = chunk(embeds, 3)
  for (const embedChunk of embedChunks) {
    await webhookClient.send({
      embeds: embedChunk,
    })
  }
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening for websub requests on port: ${port}`)
})
