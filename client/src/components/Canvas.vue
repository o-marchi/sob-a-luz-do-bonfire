<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import bonfireSprite from '@/assets/bonfire-sprite.png'

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

    if (state.value.width <= 480) {
      this.y = 390
    } else if (state.value.width <= 768) {
      this.y = 433
    } else {
      this.y = 495
    }

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
const state = ref<CanvasState | null>(null)
const animationFrame = ref<number | null>(null)

const random = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min)
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
