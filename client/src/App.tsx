import { Toaster } from "@/components/ui/sonner";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import UnitSelection from "./pages/UnitSelection";
import Dashboard from "./pages/Dashboard";
import Barbers from "./pages/Barbers";
import Services from "./pages/Services";
import Products from "./pages/Products";
import Appointments from "./pages/Appointments";
import Commissions from "./pages/Commissions";
import Scheduling from "./pages/Scheduling";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Plans from "./pages/Plans";
import BarberLogin from "./pages/BarberLogin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/units"} component={UnitSelection} />
      <Route path={"/dashboard/:branchId"} component={Dashboard} />
      <Route path={"/dashboard/:branchId/barbers"} component={Barbers} />
      <Route path={"/dashboard/:branchId/services"} component={Services} />
      <Route path={"/dashboard/:branchId/products"} component={Products} />
      <Route path={"/dashboard/:branchId/appointments"} component={Appointments} />
      <Route path={"/dashboard/:branchId/commissions"} component={Commissions} />
      <Route path={"/dashboard/:branchId/scheduling"} component={Scheduling} />
      <Route path={"/plans"} component={Plans} />
      <Route path={"/barbeiro-login"} component={BarberLogin} />
      <Route path={"/esqueci-senha"} component={ForgotPassword} />
      <Route path={"/redefinir-senha"} component={ResetPassword} />
      <Route path={"/checkout/success"} component={CheckoutSuccess} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          <PWAInstallBanner />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
