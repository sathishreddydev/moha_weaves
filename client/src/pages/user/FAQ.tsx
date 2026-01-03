import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle, Package, Truck, Shield, CreditCard } from "lucide-react";

const faqData = [
  {
    category: "General",
    icon: HelpCircle,
    questions: [
      {
        question: "What is Moha Weaves?",
        answer: "Moha Weaves is a premium online store specializing in handcrafted sarees and traditional Indian textiles. We work directly with skilled artisans to bring you authentic, high-quality products that celebrate India's rich textile heritage."
      },
      {
        question: "Where are your products sourced from?",
        answer: "Our products are sourced directly from skilled artisans and weaving communities across India, including regions famous for their traditional weaving techniques like Kanchipuram, Banaras, Mysore, and more."
      },
      {
        question: "How can I be sure of the quality?",
        answer: "We have a strict quality control process where each product is carefully inspected for craftsmanship, material quality, and authenticity. We also provide detailed product descriptions and high-quality images to help you make informed decisions."
      },
      {
        question: "Do you have physical stores?",
        answer: "Currently, we operate primarily online. However, we do have a flagship store in Bangalore where you can view our collection by appointment. You can find our address on the Contact Us page."
      }
    ]
  },
  {
    category: "Products",
    icon: Package,
    questions: [
      {
        question: "What types of sarees do you offer?",
        answer: "We offer a wide variety of sarees including silk sarees, cotton sarees, designer sarees, traditional sarees, and fusion wear. Our collection includes Kanchipuram silk, Banarasi silk, Mysore silk, Chanderi, and many more regional specialties."
      },
      {
        question: "How do I choose the right size?",
        answer: "Most sarees come in standard sizes (5.5-6 meters for the saree and 0.8-1 meter for the blouse piece). Each product page includes detailed measurements. For custom sizing, please contact our customer service."
      },
      {
        question: "Are the colors in the photos accurate?",
        answer: "We strive to display colors as accurately as possible. However, due to monitor settings and lighting conditions, there might be slight variations. We recommend reading the color descriptions provided in product details."
      },
      {
        question: "Do you offer customization services?",
        answer: "Yes, we offer customization for blouse designs, borders, and in some cases, color variations. Please contact our customer service team with your requirements and timeline."
      }
    ]
  },
  {
    category: "Shipping & Delivery",
    icon: Truck,
    questions: [
      {
        question: "What are the shipping charges?",
        answer: "We offer free shipping on orders above ₹1000 within India. For orders below ₹1000, standard shipping charges of ₹100 apply. International shipping charges vary by location."
      },
      {
        question: "How long does delivery take?",
        answer: "Standard delivery within India takes 5-7 business days. Express delivery takes 2-3 business days. International delivery takes 10-15 business days depending on the location."
      },
      {
        question: "Do you ship internationally?",
        answer: "Yes, we ship to most countries worldwide. International shipping charges and delivery times vary by destination. You can check if we ship to your country during checkout."
      },
      {
        question: "How can I track my order?",
        answer: "Once your order is shipped, you'll receive an email with tracking details. You can also track your order by logging into your account and viewing your order history."
      },
      {
        question: "What if I'm not available when the delivery arrives?",
        answer: "Our delivery partners will attempt delivery twice. If you're not available, they'll leave a notification with contact details to reschedule delivery or you can pick it up from their local office."
      }
    ]
  },
  {
    category: "Returns & Exchanges",
    icon: Shield,
    questions: [
      {
        question: "What is your return policy?",
        answer: "We offer a 7-day return policy from the date of delivery. Products must be unused, in original packaging, with all tags attached. Customized items cannot be returned unless there's a manufacturing defect."
      },
      {
        question: "How do I initiate a return?",
        answer: "You can initiate a return through your account dashboard or by contacting our customer service. We'll provide you with a return shipping label and instructions."
      },
      {
        question: "When will I receive my refund?",
        answer: "Refunds are processed within 5-7 business days after we receive and inspect the returned item. The amount will be credited to your original payment method."
      },
      {
        question: "Can I exchange an item?",
        answer: "Yes, you can exchange items within 7 days of delivery. You can exchange for a different size, color, or even a different product of equal or higher value (paying the difference if applicable)."
      },
      {
        question: "What if I receive a damaged item?",
        answer: "If you receive a damaged item, please contact us immediately with photos of the damage. We'll arrange for a replacement or full refund at no additional cost to you."
      }
    ]
  },
  {
    category: "Payment",
    icon: CreditCard,
    questions: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit/debit cards, UPI, net banking, wallets (Paytm, PhonePe, Amazon Pay), and cash on delivery for orders above ₹500."
      },
      {
        question: "Is it safe to use my credit card on your site?",
        answer: "Yes, absolutely. We use industry-standard SSL encryption and secure payment gateways to ensure your payment information is always protected."
      },
      {
        question: "Do you offer EMI options?",
        answer: "Yes, we offer EMI options on select credit cards for purchases above ₹3000. The EMI option will be displayed during checkout if available for your card."
      },
      {
        question: "Can I pay in installments without a credit card?",
        answer: "Yes, we partner with various buy-now-pay-later services that allow you to pay in installments using your bank account or UPI."
      }
    ]
  }
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFAQ = faqData.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => 
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-gray-600 mb-8">
            Find answers to common questions about our products, shipping, returns, and more.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search for answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {searchTerm && filteredFAQ.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No results found for "{searchTerm}"</p>
            <p className="text-sm text-gray-400 mt-2">Try different keywords or browse the categories below.</p>
          </div>
        )}

        <div className="space-y-8">
          {filteredFAQ.map((category) => {
            const IconComponent = category.icon;
            return (
              <Card key={category.category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((faq, index) => (
                      <AccordionItem key={index} value={`${category.category}-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-gray-600">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Still have questions section */}
        <Card className="mt-12">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-4">Still have questions?</h3>
              <p className="text-gray-600 mb-6">
                Can't find the answer you're looking for? Our customer support team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/contact">
                  <button className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
                    Contact Support
                  </button>
                </a>
                <a href="mailto:support@mohaweaves.com">
                  <button className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                    Email Us
                  </button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
