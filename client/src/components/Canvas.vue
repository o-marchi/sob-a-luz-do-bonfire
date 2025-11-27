<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCampaignStore } from '@/stores/campaign.ts'
import bonfireSprite from '@/assets/bonfire-sprite.png'
import { storeToRefs } from 'pinia'

const campaignStore = useCampaignStore()
const { campaign } = storeToRefs(campaignStore)

const state = ref<CanvasState | null>(null)

watch(
  () => state.value,
  () => {
    maybeCreatePlayers()
  },
)

watch(
  () => campaign.value?.players,
  () => {
    maybeCreatePlayers()
  },
  { imediate: true },
)

interface CanvasState {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  width: number
  height: number
  particles: Particle[]
  bonfire: Bonfire | null
}

class Particle {
  x: number
  y: number
  radius: number
  dx: number
  dy: number
  hue: number
  opacity: number
  saturation: number

  constructor() {
    this.reset()
  }

  reset() {
    if (!state.value) {
      return
    }

    this.x = Math.random() * state.value.width
    this.y = Math.random() * state.value.height
    this.radius = Math.random() * 2 + 1
    this.dx = (Math.random() - 0.5) * 0.5
    this.dy = (Math.random() - 0.5) * 0.5
    this.hue = random(0, 60)
    this.opacity = random(3, 20)
    this.saturation = random(0, 100)
  }

  update() {
    if (!state.value) {
      return
    }

    this.x += this.dx
    this.y += this.dy
    this.opacity = this.opacity + random(-40, 40) / 300

    const outOfBounds: boolean =
      this.x < 0 || this.x > state.value.width || this.y < 0 || this.y > state.value.height

    if (outOfBounds) {
      this.reset()
    }
  }

  draw() {
    if (!state.value) {
      return
    }

    const context: CanvasRenderingContext2D = state.value.context

    context.beginPath()
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2)

    context.fillStyle = `hsla(${this.hue}, ${this.saturation}%, 60%, ${this.opacity / 10})`
    context.fill()
  }
}

class Player {
  order: number
  debug: boolean
  x: number
  y: number
  loaded: boolean
  img: Image
  bobOffset: number
  bobPhase: number
  light: number
  lightPulse: number
  name: string
  avatar: string

  constructor(order, name, avatar) {
    this.order = order
    this.debug = false
    this.x = 0
    this.y = 0
    this.loaded = false
    this.bobOffset = 0
    this.bobPhase = Math.random() * Math.PI * 2
    this.light = 54
    this.lightPulse = 0.1
    this.avatar = avatar

    this.name = name

    if (this.avatar) {
      this.img = new Image()
      this.img.src = this.avatar
      this.img.onload = () => {
        this.loaded = true
      }
    } else {
      this.loaded = true
    }
  }

  update() {
    const time = performance.now() / 1000
    this.bobOffset = Math.sin(time * 2 + this.bobPhase) * 1

    this.lightPulse = time * 2
    this.light = 50 + (Math.sin(this.lightPulse) + 1) * 0.2 * (90 - 50)
  }

  draw() {
    if (!state.value) {
      return
    }

    if (!this.loaded) {
      return
    }

    const context: CanvasRenderingContext2D = state.value.context
    const playerPosition = playersPositions[this.order]

    const centerY = getCenterY(state.value.width)
    const centerX = state.value.width / 2

    this.x = centerX + playerPosition.x + this.bobOffset
    this.y = centerY + playerPosition.y + this.bobOffset

    // Calculate direction vector from bonfire to avatar
    const dx = this.x - centerX
    const dy = this.y - centerY
    const length = Math.sqrt(dx * dx + dy * dy)
    const shadowDistance = 8

    // Normalize and offset
    const offsetX = length ? (dx / length) * shadowDistance : 0
    const offsetY = length ? (dy / length) * shadowDistance : 0

    // Draw shadow
    context.save()
    context.globalAlpha = 0.4
    context.beginPath()
    context.arc(this.x + offsetX, this.y + offsetY, 20, 0, Math.PI * 2)
    context.closePath()
    context.fillStyle = 'black'
    context.filter = 'blur(6px)'
    context.fill()
    context.restore()

    // // draw background and letter
    context.save()
    context.beginPath()
    context.arc(this.x, this.y, 20, 0, Math.PI * 2)
    context.closePath()
    context.clip()
    context.fillStyle = '#faac55'
    context.fillRect(this.x - 20, this.y - 20, 40, 40)
    context.restore()

    if (this.name && this.name.length) {
      context.fillStyle = `black`
      context.font = 'bold 20px Mulish'
      context.fillText(this.name[0], this.x - 6, this.y + 7, 20)
    }

    // draw avatar
    if (this.avatar) {
      context.save()
      context.beginPath()
      context.arc(this.x, this.y, 20, 0, Math.PI * 2)
      context.closePath()
      context.clip()
      context.drawImage(this.img, this.x - 20, this.y - 20, 40, 40)
      context.restore()
    }

    // draw border
    context.beginPath()
    context.arc(this.x, this.y, 20, 0, Math.PI * 2)
    context.strokeStyle = `hsla(15, 33%, ${this.light}%, 1)`
    context.lineWidth = 1
    context.stroke()

    if (this.debug) {
      context.fillStyle = `black`
      context.font = '20px Arial'
      context.fillText(this.order.toString(), this.x - 5, this.y + 7, 20)
    }
  }
}

class Bonfire {
  image: HTMLImageElement
  frame: {
    width: number
    height: number
    length: number
  }
  y: number
  currentFrame: number
  frameTimer: number
  frameInterval: number
  scale: number
  glowRadius: number
  glowPulse: number
  glowSpeed: number
  glowMinRadius: number
  glowMaxRadius: number
  glowStartcolor: string
  glowEndcolor: string

  constructor(image: HTMLImageElement, frame: { width: number; height: number; length: number }) {
    this.image = image
    this.frame = frame

    this.y = 495
    this.currentFrame = 0
    this.frameTimer = 0
    this.frameInterval = 500
    this.scale = 0.8
    this.glowRadius = 200
    this.glowPulse = 0
    this.glowSpeed = 0.01
    this.glowMinRadius = 170
    this.glowMaxRadius = 200
    this.glowStartcolor = 'rgba(255, 150, 50, 0.3)'
    this.glowEndcolor = 'rgba(205, 100, 50, 0)'
  }

  update(delta: number) {
    if (!state.value) {
      return
    }

    this.frameTimer += delta

    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer = 0
      this.currentFrame = (this.currentFrame + 1) % this.frame.length
    }

    this.y = getCenterY(state.value.width)

    this.glowPulse = (this.glowPulse + this.glowSpeed) % (Math.PI * 2)
    this.glowRadius =
      this.glowMinRadius +
      (Math.sin(this.glowPulse) + 1) * 0.5 * (this.glowMaxRadius - this.glowMinRadius)
  }

  drawGlow() {
    if (!state.value) {
      return
    }

    const context: CanvasRenderingContext2D = state.value.context
    const scaledWidth = this.frame.width * this.scale
    const scaledHeight = this.frame.height * this.scale
    const centerX = (state.value.width - scaledWidth) / 2
    const centerY = this.y + scaledHeight / 2 + 20

    const gradient = context.createRadialGradient(
      centerX + scaledWidth / 2,
      centerY,
      0,
      centerX + scaledWidth / 2,
      centerY,
      this.glowRadius,
    )

    gradient.addColorStop(0, this.glowStartcolor)
    gradient.addColorStop(1, this.glowEndcolor)

    context.fillStyle = gradient
    context.fillRect(
      centerX - this.glowRadius,
      centerY - this.glowRadius,
      scaledWidth + this.glowRadius * 2,
      scaledHeight + this.glowRadius * 2,
    )
  }

  draw() {
    if (!state.value) {
      return
    }

    const context: CanvasRenderingContext2D = state.value.context

    context.save()

    this.drawGlow()
    context.filter = 'saturate(0.6) contrast(1.1)'

    const scaledWidth = this.frame.width * this.scale
    const scaledHeight = this.frame.height * this.scale
    const centerX = (state.value.width - scaledWidth) / 2

    context.drawImage(
      this.image,
      this.currentFrame * this.frame.width,
      0,
      this.frame.width,
      this.frame.height,
      centerX,
      this.y,
      scaledWidth,
      scaledHeight,
    )

    context.restore()
  }
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const animationFrame = ref<number | null>(null)

const generatePlayerPositions = () => {
  const bases = [
    { x: 220, y: 140 },
    { x: 170, y: 0 },
    { x: 170, y: 270 },
    { x: 300, y: 60 },
    { x: 310, y: 200 },
    { x: 380, y: -30 },
    { x: 420, y: 130 },
    { x: 380, y: 290 },
    { x: 60, y: -30 },
    { x: 60, y: 320 },
    { x: 250, y: 300 },
    { x: 250, y: 0 },
    { x: 320, y: 130 },
    { x: 450, y: 45 },
    { x: 460, y: 220 },
    { x: 520, y: 140 },
  ]

  return bases.reduce((acc, base, index) => {
    acc.push({ x: -base.x, y: base.y })
    acc.push({ x: base.x + 10, y: base.y })
    return acc
  }, [])
}

const playersPositions = generatePlayerPositions()

const random = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min)
}

const getCenterY = (width) => {
  if (width <= 480) {
    return 390
  }

  if (width <= 768) {
    return 433
  }

  return 495
}

const resizeCanvas = () => {
  if (!state.value) {
    return
  }

  const width = window.innerWidth
  const height = 1350

  state.value.width = width
  state.value.height = height
  state.value.canvas.width = width
  state.value.canvas.height = height
  state.value.canvas.style.width = `${width}px`
  state.value.canvas.style.height = `${height}px`

  createParticles(150)
}

const createParticles = (count: number) => {
  if (!state.value) {
    return
  }

  state.value.particles = []

  for (let i = 0; i < count; i++) {
    const particle = new Particle()
    state.value.particles.push(particle)
  }
}

const maybeCreatePlayers = () => {
  if (!state || !state.value) {
    return
  }

  if (!campaign?.value?.players || !campaign?.value?.players.length) {
    return
  }

  createPlayers()
}

const createPlayers = () => {
  state.value.players = []

  // playersPositions.forEach((position, index) => {
  //   const player = new Player(index, 'a')
  //   state.value.players.push(player)
  // })

  campaign?.value?.players.forEach((campaignPlayer, index) => {
    const player = new Player(
      index,
      campaignPlayer?.player?.name,
      campaignPlayer?.player?.discord?.avatar,
    )
    state.value.players.push(player)
  })
}

const igniteBonfire = () => {
  if (!state.value) {
    return
  }

  const image = new Image()
  image.src = bonfireSprite
  image.onload = () => {
    if (!state.value) {
      return
    }

    state.value.bonfire = new Bonfire(image, {
      width: 320,
      height: 332,
      length: 6,
    })

    document.body.classList.add('bonfire-lit')
  }
}

const animate = () => {
  if (!state.value) {
    return
  }

  const context: CanvasRenderingContext2D = state.value.context

  context.clearRect(0, 0, state.value.width, state.value.height)

  state.value.particles.forEach((particle) => {
    particle.update()
    particle.draw()
  })

  state.value.players.forEach((player) => {
    player.update()
    player.draw()
  })

  const bonfire = state.value.bonfire

  if (bonfire) {
    bonfire.update(1000 / 60)
    bonfire.draw()
  }

  animationFrame.value = requestAnimationFrame(animate)
}

const initCanvas = () => {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  state.value = {
    canvas: canvas,
    context,
    width: canvas.width,
    height: canvas.height,
    particles: [],
    bonfire: null,
    players: [],
  }

  resizeCanvas()
  igniteBonfire()
  animate()

  window.addEventListener('resize', resizeCanvas)
}

onMounted(() => {
  initCanvas()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)

  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
})
</script>

<template>
  <canvas ref="canvasRef" class="background-canvas"></canvas>
</template>
