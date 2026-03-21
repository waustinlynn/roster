namespace Roster.Application.Queries.GetBalanceMatrix;
using MediatR;

public record GetBalanceMatrixQuery(Guid TeamId) : IRequest<BalanceMatrixDto>;

public record BalanceMatrixDto(
    IReadOnlyList<string> Positions,
    IReadOnlyList<PlayerBalanceRow> Rows);

public record PlayerBalanceRow(
    Guid PlayerId,
    string PlayerName,
    bool IsActive,
    IReadOnlyDictionary<string, int> Counts);
