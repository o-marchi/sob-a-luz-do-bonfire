import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import authPlugin from './plugins/auth'
import campaignPlugin from './plugins/campaign'

const app = createApp(App)

app.use(createPinia())
app.use(authPlugin)
app.use(campaignPlugin)
app.use(router)

app.mount('#app')
