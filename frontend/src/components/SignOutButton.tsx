import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./Button";

/** Secondary button that clears the token and opens the login page. */
export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  /** Log out and go to /login. */
  function handleClick() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <Button variant="secondary" className={className} onClick={handleClick}>
      Sign out
    </Button>
  );
}
