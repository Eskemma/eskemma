// app/components/componentsHome/RecoverPassword.tsx
"use client";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../../firebase/firebaseConfig";
import Button from "../Button";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!email.trim()) {
        throw new Error("The email address is required.");
      }

      await sendPasswordResetEmail(auth, email);
      setMessage(
        "An email has been sent with instructions to reset your password."
      );
    } catch (error: any) {
      console.error("Error sending the recovery email:", error.message);

      if (error.code === "auth/user-not-found") {
        setError("No user found with this email address.");
      } else {
        setError("An error occurred while trying to recover the password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#0B1620] px-4">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-8 max-sm:p-6 w-full max-w-md">
        <h1 className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske text-center mb-6 max-sm:mb-4">
          Recuperar Contraseña
        </h1>

        {message && (
          <p 
            className="text-green-eske text-sm max-sm:text-xs text-center mb-4 max-sm:mb-3 p-3 max-sm:p-2 bg-green-eske/10 border border-green-eske/30 rounded" 
            role="alert"
            aria-live="polite"
          >
            {message}
          </p>
        )}
        {error && (
          <p 
            className="text-red-eske text-sm max-sm:text-xs text-center mb-4 max-sm:mb-3 p-3 max-sm:p-2 bg-red-eske/10 border border-red-eske/30 rounded" 
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-sm:space-y-3">
          <div>
            <label 
              htmlFor="recover-email"
              className="block text-[18px] max-sm:text-base font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              id="recover-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="tu@email.com"
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-eske-40 dark:border-white/10 rounded focus-ring-primary disabled:bg-gray-eske-10 bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] text-base max-sm:text-sm"
            />
          </div>

          <Button
            label={loading ? "ENVIANDO..." : "ENVIAR MAIL DE RECUPERACIÓN"}
            variant="primary"
            disabled={loading}
            type="submit"
          />
        </form>

        {/* Link para volver al login */}
        <div className="mt-6 max-sm:mt-4 text-center">
          <a
            href="/"
            className="text-[14px] max-sm:text-xs text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
