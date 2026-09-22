import { useNavigate } from "react-router-dom";
import LandingPage from "@/components/LandingPage";

const Landing = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    try {
      localStorage.setItem("agriwatch_auth", "true");
    } catch (_) {}
    navigate("/dashboard");
  };

  return <LandingPage onEnter={handleEnter} />;
};

export default Landing;
