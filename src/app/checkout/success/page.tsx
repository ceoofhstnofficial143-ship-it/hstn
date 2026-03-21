import Link from "next/link"

export default async function CheckoutSuccess(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams;
  const orderId = (searchParams?.order_id as string) || "UNVERIFIED"
  const shortOrderId = orderId.split('-')[0].toUpperCase()

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 py-20 animate-fade-in relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl w-full text-center relative z-10 space-y-10">
        
        {/* Animated Checkmark */}
        <div className="relative mx-auto w-24 h-24 mb-12">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            <div className="relative flex justify-center items-center w-full h-full bg-green-500/10 border border-green-500/30 rounded-full backdrop-blur-sm">
                <span className="text-4xl text-green-500 font-black">✓</span>
            </div>
        </div>

        {/* Header Block */}
        <div className="space-y-4">
            <span className="text-[11px] uppercase tracking-[0.4em] text-primary font-bold">Acquisition Successful</span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter italic">
                Protocol <br className="md:hidden" />Confirmed
            </h1>
        </div>

        {/* Ledger Confirmation Card */}
        <div className="luxury-card p-8 md:p-12 bg-white/5 border border-white/10 rounded-3xl mx-auto backdrop-blur-md">
            <div className="space-y-6">
                <div>
                   <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-bold mb-2">Immutable Ledger ID</p>
                   <p className="text-3xl md:text-4xl font-mono font-black tracking-tight text-white">#{shortOrderId}</p>
                   <p className="text-[9px] text-white/30 uppercase tracking-widest mt-2">{orderId}</p>
                </div>
                
                <div className="h-px w-full bg-white/10 my-6" />

                <div className="flex items-start justify-center gap-4 text-left">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white">Escrow Secured</p>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1.5 leading-relaxed">
                      Funds are locked. They will only release to the merchant after successful delivery and your final authorization.
                    </p>
                  </div>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-8 space-y-6">
            <Link 
                href="/orders" 
                className="luxury-button w-full sm:w-auto inline-block !bg-primary !text-black !py-4 !px-12 !text-[11px] uppercase tracking-[0.3em] font-black"
            >
                Enter Portfolio
            </Link>
            
            <div className="block">
                <Link 
                    href="/" 
                    className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 hover:text-white transition-smooth underline decoration-white/20 underline-offset-8 hover:decoration-white"
                >
                    Return to Scouting Hub
                </Link>
            </div>
        </div>

      </div>
    </main>
  )
}
