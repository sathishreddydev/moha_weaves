import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { BRAND_DOMAIN } from "@/lib/brand";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!authLoading && user?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password, "admin");
      if (result.success) {
        toast({ title: "Welcome!", description: "Signed in successfully." });
        navigate("/admin/dashboard");
      } else {
        toast({ title: "Login failed", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginLayout
      icon={Shield}
      title="Admin Portal"
      subtitle="Manage your entire business from one place."
      features={[
        "Product & category management",
        "Order tracking & fulfillment",
        "User & staff management",
        "Sales, coupons & promotions",
        "Analytics & reporting",
      ]}
    >
      <div>
        <h2 className="text-lg font-medium mb-1" data-testid="text-page-title">
          Sign in
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your admin credentials
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <TextField
                      type="email"
                      placeholder={`admin@${BRAND_DOMAIN}`}
                      startAdornment={<Mail className="h-4 w-4 text-muted-foreground" />}
                      data-testid="input-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <TextField
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      startAdornment={<Lock className="h-4 w-4 text-muted-foreground" />}
                      endAdornment={
                        showPassword ? (
                          <EyeOff
                            className="h-4 w-4 text-muted-foreground cursor-pointer"
                            onClick={() => setShowPassword(false)}
                          />
                        ) : (
                          <Eye
                            className="h-4 w-4 text-muted-foreground cursor-pointer"
                            onClick={() => setShowPassword(true)}
                          />
                        )
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-submit"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>
      </div>
    </LoginLayout>
  );
}
