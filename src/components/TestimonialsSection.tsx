"use client"

import { Card } from "@/components/ui/card"
import { Star, Quote } from "lucide-react"

export function TestimonialsSection() {
  const testimonials = [
    {
      name: "Анна Петрова",
      role: "Директор интернет-магазина «ДомТекстиль»",
      rating: 5,
      text: "Раньше мы тратили 20 часов в неделю на обработку прайсов — теперь это делается автоматически за 2 часа. Продажи выросли на 35%!"
    },
    {
      name: "Михаил Сидоров", 
      role: "Владелец сети «СпортМир»",
      rating: 5,
      text: "Благодаря MarketGrow мы смогли загрузить в 3 раза больше товаров на Wildberries и Ozon. Оборот увеличился на 180%!"
    },
    {
      name: "Елена Козлова",
      role: "Менеджер по закупкам «ТехноПро»", 
      rating: 5,
      text: "Забыли про ошибки в карточках товаров. Система сама оптимизирует описания и цены. Экономим 15 часов в неделю!"
    }
  ]

  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Истории успеха наших клиентов
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Реальные результаты бизнеса, который доверил нам автоматизацию продаж
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-8 relative hover:shadow-xl transition-shadow bg-card">
              <Quote className="w-8 h-8 text-primary/20 absolute top-6 right-6" />
              
              <div className="flex mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>

              <p className="text-muted-foreground mb-6 leading-relaxed italic">
                "{testimonial.text}"
              </p>

              <div className="border-t pt-4">
                <div className="font-semibold">{testimonial.name}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-8">Нам доверяют более 1000 компаний</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {['Wildberries', 'OZON', 'Яндекс.Маркет', 'AliExpress', 'Авито'].map((marketplace) => (
              <div key={marketplace} className="px-6 py-3 bg-muted rounded-lg font-medium text-sm">
                {marketplace}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}