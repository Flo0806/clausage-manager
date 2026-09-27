import '@unocss/reset/tailwind.css'
import './assets/fonts/geist.css'
import '@fontsource-variable/geist-mono'
import 'virtual:uno.css'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'
import { i18n } from './i18n'

const app = createApp(App)

const router = createRouter({
  history: createWebHistory(),
  routes,
})

app.use(router)
app.use(i18n)

app.mount('#app')
