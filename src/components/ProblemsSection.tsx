"use client"

import { AlertTriangle, Clock, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"

export function ProblemsSection() {
  const problems = [
    {
      icon: AlertTriangle,
      title: "Сложные файлы поставщиков",
      description: "Неструктурированные данные в Excel, CSV, XML требуют часов ручной обработки"
    },
    {
      icon: TrendingDown,
      title: "Ошибки при ручной обработке",
      description: "Человеческий фактор приводит к потерям продаж и недовольству клиентов"
    },
    {
      icon: Clock,
      title: "Потеря времени и денег",
      description: "20+ часов в неделю на рутину вместо развития бизнеса"
    }
  ]

  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            В чём проблема?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Каждый день бизнес теряет деньги из-за неэффективной обработки данных поставщиков
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <Card key={index} className="p-8 text-center hover:shadow-lg transition-shadow bg-card/50">
              <div className="w-16 h-16 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
                <problem.icon className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold mb-4">{problem.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {problem.description}
              </p>
            </Card>
          ))}
        </div>

        {/* Pain Points Stats */}
        <div className="mt-16 bg-card p-8 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-destructive mb-2">47%</div>
              <div className="text-sm text-muted-foreground">товаров не попадают на маркетплейс</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-destructive mb-2">15 ошибок</div>
              <div className="text-sm text-muted-foreground">в среднем при ручной обработке</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-destructive mb-2">₽50,000</div>
              <div className="text-sm text-muted-foreground">потери в месяц из-за ошибок</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}