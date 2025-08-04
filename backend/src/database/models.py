from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, String, Text, JSON, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from .config import Base

class ContractAnalysis(Base):
    """Model for storing smart contract analysis results."""
    __tablename__ = "contract_analyses"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    contract_address: Mapped[str] = mapped_column(String(42), index=True, nullable=False)
    network: Mapped[str] = mapped_column(String(50), default="mainnet")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Analysis results
    static_analysis: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    dynamic_analysis: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    security_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    # Additional metadata
    contract_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    compiler_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_verified: Mapped[bool] = mapped_column(default=False)
    
    # Relationships
    vulnerabilities: Mapped[List["Vulnerability"]] = relationship(
        "Vulnerability", back_populates="analysis", cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<ContractAnalysis {self.contract_address} on {self.network}>"


class Vulnerability(Base):
    """Model for storing individual vulnerabilities found in contracts."""
    __tablename__ = "vulnerabilities"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("contract_analyses.id", ondelete="CASCADE"), nullable=False
    )
    
    # Vulnerability details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # high, medium, low, info
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # File and line number
    
    # Additional metadata
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cwe_id: Mapped[Optional[int]] = mapped_column(nullable=True)  # Common Weakness Enumeration ID
    swc_id: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Smart Contract Weakness Classification
    
    # Relationships
    analysis: Mapped["ContractAnalysis"] = relationship(
        "ContractAnalysis", back_populates="vulnerabilities"
    )
    
    def __repr__(self) -> str:
        return f"<Vulnerability {self.title} ({self.severity})>"


class AnalysisCache(Base):
    """Model for caching analysis results to avoid redundant processing."""
    __tablename__ = "analysis_cache"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self) -> str:
        return f"<AnalysisCache {self.cache_key}>"
