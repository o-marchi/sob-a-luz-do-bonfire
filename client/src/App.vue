<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Title from './components/Title.vue'
import Login from '@/components/Login.vue'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { NConfigProvider, darkTheme, ptBR, datePtBR, GlobalThemeOverrides, NMenu } from 'naive-ui'

const canvasRef = ref(null)

let ctx, width, height, animationFrameId
const particles = []

function random(min, max) {
  return Math.random() * (max - min) + min;
}

class Particle {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = Math.random() * width
    this.y = Math.random() * height
    this.radius = Math.random() * 2 + 1
    this.dx = (Math.random() - 0.5) * 0.5
    this.dy = (Math.random() - 0.5) * 0.5
    this.hue = random(0, 60)
    this.opacity = random(3, 10)
    this.saturation = random(0, 100)
  }

  update() {
    this.x += this.dx
    this.y += this.dy
    this.opacity = this.opacity + random(-40, 40) / 300;

    if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.reset()
    }
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)

    ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, 60%, ${this.opacity / 10})`
    ctx.fill()
  }
}

class FireParticle {
  x: number
  y: number
  radius: number
  dx: number
  dy: number
  life: number
  maxLife: number

  constructor() {
    this.maxLife = 500 + Math.random() * 9900 // longer life for lingering
    this.life = Math.random() * this.maxLife
    this.reset(true)
  }

  reset(randomLife = false) {
    const centerX = width / 2
    const centerY = 590

    this.x = centerX + (Math.random() - 0.5) * 60
    this.y = centerY + (Math.random() - 0.5) * 20
    this.radius = Math.random() * 2 + 1
    this.dx = (Math.random() - 0.5) * 1.5
    this.dy = -(Math.random() * 0.3 + 0.1)

    if (randomLife) {
      this.life = Math.random() * this.maxLife // random life so particle appears “mid-flight”
    } else {
      this.life = 0
    }
  }

  update() {
    this.x += this.dx
    this.y += this.dy
    this.life++

    if (this.life > this.maxLife || this.y < 0 || this.x < 0 || this.x > width) {
      this.reset()
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 180, 50, 0.7)'
    ctx.fill()
  }
}

function drawLinks(ctx) {
  const maxDist = 100 // max distance to draw a link

  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i]
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j]
      const dx = p1.x - p2.x
      const dy = p1.y - p2.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < maxDist) {
        ctx.strokeStyle = `rgba(255, 180, 50, ${((maxDist - dist) / maxDist) * 0.3})` // fade by distance
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }
  }
}

function animate() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  particles.forEach((p) => {
    p.update()
    p.draw(ctx)
  })
  // drawLinks(ctx);
  animationFrameId = requestAnimationFrame(animate)
}

function resizeCanvas() {
  width = window.innerWidth;
  height = document.body.scrollHeight;
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.width = width;
    canvas.height = height;

    // Optional: Reset particles to match new canvas size
    particles.length = 0; // Clear old particles
    for (let i = 0; i < 100; i++) {
      particles.push(new Particle());
    }
  }
}

function createParticles(count: number) {
  particles.length = 0
  for (let i = 0; i < count; i++) {
    const p = new Particle()
    p.life = Math.random() * p.maxLife // start “mid-flight”
    particles.push(p)
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    ctx = canvas.getContext('2d')
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    createParticles(100) // create all particles once at start

    animate()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  cancelAnimationFrame(animationFrameId)
})

const activeMenu = ref<string | null>(null);

const menuOptions: any[] = [
  {
    label: 'Home',
    path: '/'
  },
  {
    label: 'Lista de Jogos',
    path: '/games-list'
  }
]

const themeOverrides: GlobalThemeOverrides = {
  Tooltip: {
    color: '#141215',
  },
  common: {
    primaryColor: '#8192FF',
    borderRadius: '4px',
    modalColor: '#18131C',
    closeColorHover: 'black',
  },
  Input: {
    border: '#5d4041',
    borderFocus: '#5e2e30',
    borderHover: '#5d4041',
  },
  Switch: {
    // railColorActive: '#5d4041',
  }
}
</script>

<template>
  <n-config-provider
    :theme="darkTheme"
    :locale="ptBR"
    :date-locale="datePtBR"
    :theme-overrides="themeOverrides"
  >
    <canvas ref="canvasRef" class="background-canvas"></canvas>

    <header>
      <div class="wrapper">
        <Login />
        <Title />

        <div class="main-menu-wrapper">
<!--          <n-menu-->
<!--            class="main-menu"-->
<!--            :options="menuOptions"-->
<!--            v-model:value="activeMenu"-->
<!--            mode="horizontal"-->
<!--          ></n-menu>-->
        </div>
      </div>
    </header>

    <main>
      <RouterView />
    </main>
  </n-config-provider>
</template>