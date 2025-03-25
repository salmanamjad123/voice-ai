import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

const LOCAL_STORAGE_KEY = "user_data";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize user from localStorage
    const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch the current user
  const { data: currentUser, error: userError } = useQuery<User | null>({
    queryKey: ["/api/user"],
    // Use localStorage data during loading
    initialData: user,
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        if (!res.ok) {
          if (res.status === 401) {
            // Keep existing localStorage data if it exists
            const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedUser) {
              return JSON.parse(savedUser);
            }
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            return null;
          }
          throw new Error("Failed to fetch user");
        }
        const data = await res.json();
        // Update localStorage with fresh data
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return data;
      } catch (error) {
        console.error("Error fetching user:", error);
        // Keep existing localStorage data if available
        const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
        return savedUser ? JSON.parse(savedUser) : null;
      }
    },
  });

  // Update user state when currentUser changes
  useEffect(() => {
    if (userError) {
      console.error("Error fetching user:", userError);
      // Don't clear localStorage or redirect on error,
      // let the query retry with existing data
      setUser(null);
    } else {
      setUser(currentUser);
      if (currentUser) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentUser));
      }
    }
    setLoading(false);
  }, [currentUser, userError]);

  // Only redirect to /auth if we're not loading and there's no user
  useEffect(() => {
    if (!loading && !user && window.location.pathname !== '/auth') {
      setLocation('/auth');
    }
  }, [loading, user, setLocation]);

  const signUpMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/register", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sign up");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      queryClient.setQueryData(["/api/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
      toast({
        title: "Success",
        description: "Account created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signInMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Invalid credentials");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      queryClient.setQueryData(["/api/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) throw new Error("Failed to log out");
    },
    onSuccess: () => {
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/auth");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signUp = async (username: string, password: string) => {
    await signUpMutation.mutateAsync({ username, password });
  };

  const signIn = async (username: string, password: string) => {
    await signInMutation.mutateAsync({ username, password });
  };

  const logOut = async () => {
    await logOutMutation.mutateAsync();
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    logOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}