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
import { Eye, EyeOff, Lock, Mail, Store } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function StoreLogin() {
  const navigate = useNavigate();
  const { login, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!authLoading && user?.role === "store") {
    return <Navigate to="/store/dashboard" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password, "store");
      if (result.success) {
        toast({ title: "Welcome!", description: "Signed in successfully." });
        navigate("/store/dashboard");
      } else {
        toast({ title: "Login failed", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginLayout
      icon={Store}
      title="Store Portal"
      subtitle="Run your store operations seamlessly."
      features={[
        "Point of sale & billing",
        "In-store inventory view",
        "Stock requests from warehouse",
        "Exchange & return processing",
        "Sales history & invoices",
      ]}
    >
      <div>
        <h2 className="text-lg font-medium mb-1" data-testid="text-page-title">
          Sign in
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your store credentials
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
                      placeholder={`store@${BRAND_DOMAIN}`}
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
