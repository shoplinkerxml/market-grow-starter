"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function FAQSection() {
  const faqs = [
    {
      question: "А если у меня несколько поставщиков с разными форматами файлов?",
      answer: "Наша система работает с любыми форматами: Excel, CSV, XML, JSON и даже сканированными документами. Мы автоматически распознаём структуру данных и адаптируем обработку под каждого поставщика."
    },
    {
      question: "С какими маркетплейсами вы работаете?",
      answer: "Мы интегрированы со всеми популярными российскими маркетплейсами: Wildberries, OZON, Яндекс.Маркет, AliExpress Россия, Авито, Мегамаркет и другими. Постоянно добавляем новые платформы."
    },
    {
      question: "Можно ли начать бесплатно?",
      answer: "Да! Мы предоставляем 14 дней бесплатного тестирования со всеми возможностями системы. Никаких ограничений — полный доступ ко всем функциям для оценки результата."
    },
    {
      question: "Как быстро я увижу результат?",
      answer: "Первые результаты вы увидите уже в день подключения. Полную автоматизацию процесса мы настраиваем за 2-3 дня. Рост продаж обычно заметен в течение первой недели."
    },
    {
      question: "А если у меня уже есть товары на маркетплейсах?",
      answer: "Отлично! Мы поможем оптимизировать существующие карточки товаров: улучшим описания, настроим цены, добавим недостающие характеристики. Это часто даёт рост продаж на 20-30%."
    },
    {
      question: "Безопасно ли передавать вам коммерческие данные?",
      answer: "Абсолютно безопасно. Мы используем банковское шифрование, соблюдаем 152-ФЗ о персональных данных и подписываем соглашение о неразглашении. Ваши данные не передаются третьим лицам."
    }
  ]

  return (
    <section className="py-20 bg-muted/30">
      <div className="container max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Частые вопросы
          </h2>
          <p className="text-xl text-muted-foreground">
            Ответы на самые популярные вопросы о нашем сервисе
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-card px-6 rounded-lg border shadow-sm"
            >
              <AccordionTrigger className="text-left hover:no-underline py-6 text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Не нашли ответ на свой вопрос?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:support@marketgrow.ru" className="text-primary hover:underline">
              support@marketgrow.ru
            </a>
            <a href="tel:+78001234567" className="text-primary hover:underline">
              8 (800) 123-45-67
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}