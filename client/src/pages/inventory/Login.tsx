import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TextField } from "@/components/ui/TextField";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function InventoryLogin() {
  const navigate = useNavigate();
  const { login, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  if (!authLoading && user?.role === "inventory") {
    return <Navigate to="/inventory/dashboard" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password, "inventory");
      if (result.success) {
        toast({ title: "Welcome!", description: "You have successfully logged in." });
        navigate("/inventory/dashboard");
      } else {
        toast({ title: "Login failed", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Warehouse className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-semibold">Moha Inventory</h1>
          <p className="text-muted-foreground mt-2">Inventory Management Portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle data-testid="text-page-title">Inventory Login</CardTitle>
            <CardDescription>Enter your credentials to access inventory management</CardDescription>
          </CardHeader>
          <CardContent>
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
                          placeholder="inventory@moha.com"
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
                          startAdornment={
                            <Lock className="h-4 w-4 text-gray-500" />
                          }
                          endAdornment={
                            showPassword ? (
                              <EyeOff
                                className="h-4 w-4 text-gray-500 cursor-pointer"
                                onClick={() => setShowPassword(false)}
                              />
                            ) : (
                              <Eye
                                className="h-4 w-4 text-gray-500 cursor-pointer"
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

                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit">
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
              Back to Store
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
