import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, Building2 } from "lucide-react";

export default function BranchSelector() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: branchesData, isLoading } = trpc.branches.list.useQuery(undefined, {
    enabled: !!user,
  });
  const branches = branchesData?.map((branch: any) => ({ branch })) || [];

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
          <p className="text-slate-600 font-medium">Carregando unidades...</p>
        </div>
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Nenhuma Unidade</h1>
          <p className="text-slate-600 mb-6">Você não tem acesso a nenhuma unidade de barbearia.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Barbearia Control</h1>
          <p className="text-slate-600">Selecione uma unidade para começar</p>
        </div>

        <div className="grid gap-4">
          {branches.map((branch) => (
            <Card
              key={branch.branch.id}
              className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-slate-300"
              onClick={() => setLocation(`/dashboard/${branch.branch.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{branch.branch.name}</h2>
                  {branch.branch.address && (
                    <p className="text-slate-600 text-sm mt-1">{branch.branch.address}</p>
                  )}
                  {branch.branch.phone && (
                    <p className="text-slate-600 text-sm">{branch.branch.phone}</p>
                  )}
                </div>
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
