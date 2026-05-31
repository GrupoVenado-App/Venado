import grupoVenadoLogo from "../assets/grupo-venado-logo.svg";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return <img src={grupoVenadoLogo} alt="Grupo Venado" className={className} />;
}
