"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, TrendingUp } from "lucide-react"
import { useState } from "react"

export function NewsletterSection() {
  const [email, setEmail] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle newsletter subscription
    console.log("Newsletter subscription:", email)
    setEmail("")
  }

  return (
    <section className="py-20">
      <div className="container">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary-light/20 to-success-light/20 p-12 rounded-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full blur-xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-lg" />
          
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-success rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Получайте секреты роста продаж
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Еженедельная рассылка с кейсами, лайфхаками и инсайдерской информацией 
              о маркетплейсах от экспертов MarketGrow
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Введите ваш email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="h-12">
                Подписаться бесплатно
              </Button>
            </form>

            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-success" />
                5,000+ подписчиков
              </div>
              <div>📧 Без спама</div>
              <div>🚀 Только ценная информация</div>
              <div>❌ Отписка в 1 клик</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}