import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TextField } from "@/components/ui/TextField";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function UserLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const result = await login(values.email, values.password, "user");
      if (result.success) {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/");
      } else {
        toast({
          title: "Login failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="font-serif text-3xl font-semibold text-primary"
          >
            Moha
          </Link>
          <p className="text-muted-foreground mt-2">
            Welcome back to your saree journey
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle data-testid="text-page-title">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <TextField
                          type="email"
                          placeholder="you@example.com"
                          startAdornment={
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          }
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/user/register"
                className="text-primary hover:underline"
                data-testid="link-register"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Other login options:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              to="/admin/login"
              className="text-muted-foreground hover:text-primary"
            >
              Admin Login
            </Link>
            <Link
              to="/inventory/login"
              className="text-muted-foreground hover:text-primary"
            >
              Inventory Login
            </Link>
            <Link
              to="/store/login"
              className="text-muted-foreground hover:text-primary"
            >
              Store Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
