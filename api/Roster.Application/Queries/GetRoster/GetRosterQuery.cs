namespace Roster.Application.Queries.GetRoster;
using MediatR;
public record GetRosterQuery(Guid TeamId) : IRequest<IReadOnlyList<PlayerDto>>;

public record PlayerDto(
    Guid PlayerId,
    string Name,
    bool IsActive,
    IReadOnlyDictionary<string, int> Skills);
