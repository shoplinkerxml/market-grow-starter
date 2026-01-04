"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, Crown, Zap, Rocket } from "lucide-react"
import { useI18n } from "@/i18n";

export function PricingSection() {
  const { t } = useI18n();
  
  const plans = [
    {
      name: "Start",
      icon: Zap,
      price: "₽9,900",
      period: t("pricing_period"),
      description: t("pricing_desc_beginner"),
      features: [
        t("pricing_feature_1000_products"),
        t("pricing_feature_3_marketplaces"),
        t("pricing_feature_basic_automation"),
        t("pricing_feature_email_support"),
        t("pricing_feature_training")
      ],
      popular: false
    },
    {
      name: "Grow",
      icon: Rocket,
      price: "₽19,900", 
      period: t("pricing_period"),
      description: t("pricing_desc_growing"),
      features: [
        t("pricing_feature_10000_products"),
        t("pricing_feature_all_marketplaces"),
        t("pricing_feature_full_automation"),
        t("pricing_feature_priority_support"),
        t("pricing_feature_analytics"),
        t("pricing_feature_api"),
        t("pricing_feature_manager")
      ],
      popular: true
    },
    {
      name: "Pro",
      icon: Crown,
      price: "₽49,900",
      period: t("pricing_period"), 
      description: t("pricing_desc_enterprise"),
      features: [
        t("pricing_feature_unlimited_products"),
        t("pricing_feature_all_features"),
        t("pricing_feature_custom_integrations"),
        t("pricing_feature_247_support"),
        t("pricing_feature_individual_solutions"),
        t("pricing_feature_team_training"),
        t("pricing_feature_sla")
      ],
      popular: false
    }
  ]

  return (
    <section className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            {t("pricing_title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("pricing_subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative p-8 ${
                plan.popular 
                  ? 'border-primary shadow-xl scale-105 bg-gradient-to-br from-card to-primary-light/10' 
                  : 'hover:shadow-lg'
              } transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-success text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
                  {t("pricing_popular")}
                </div>
              )}

              <div className="text-center mb-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center ${
                  plan.popular ? 'bg-gradient-success' : 'bg-muted'
                }`}>
                  <plan.icon className={`w-8 h-8 ${
                    plan.popular ? 'text-primary-foreground' : 'text-foreground'
                  }`} />
                </div>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm">
                    <Check className="w-4 h-4 text-success mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.popular ? "hero" : "outline"} 
                className="w-full"
                size="lg"
              >
                {plan.popular ? t("pricing_start_earning") : t("pricing_choose_plan")}
              </Button>
            </Card>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div className="text-center bg-success-light p-8 rounded-2xl">
          <h3 className="text-xl font-semibold mb-4">💰 {t("pricing_guarantee_title")}</h3>
          <p className="text-muted-foreground mb-6">
            {t("pricing_guarantee_text")}
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div>✅ {t("pricing_free_trial")}</div>
            <div>✅ {t("pricing_refund")}</div>
            <div>✅ {t("pricing_no_hidden")}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
