"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/labels";

type ReviewData = {
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`Nota ${rating} de 5`} data-testid="review-stars">
      {"★".repeat(rating)}
      <span className="stars-empty">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewPanel({
  contractId,
  meIsClient,
  contractCompleted,
  review,
}: {
  contractId: string;
  meIsClient: boolean;
  contractCompleted: boolean;
  review: ReviewData | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(rating), comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a avaliação.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (review) {
    return (
      <div data-testid="review-display">
        <Stars rating={review.rating} />
        {review.comment && <p style={{ margin: "8px 0", fontSize: 14 }}>{review.comment}</p>}
        <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
          {review.author.name} · {formatDate(review.createdAt)}
        </span>
      </div>
    );
  }

  if (!meIsClient || !contractCompleted) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
        {contractCompleted
          ? "A avaliação fica a cargo do cliente do projeto."
          : "A avaliação fica disponível após a conclusão do projeto."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} data-testid="review-form">
      <div className="form-group">
        <label>Nota (1 a 5)</label>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          required
          data-testid="review-rating-select"
        >
          <option value="">Selecione uma nota</option>
          <option value="5">★★★★★ — Excelente</option>
          <option value="4">★★★★ — Muito bom</option>
          <option value="3">★★★ — Bom</option>
          <option value="2">★★ — Regular</option>
          <option value="1">★ — Ruim</option>
        </select>
      </div>
      <div className="form-group">
        <label>Comentário</label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Como foi trabalhar com este programador?"
          data-testid="review-comment-input"
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary" disabled={submitting} data-testid="review-submit-button">
        {submitting ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}
