namespace Roster.Application.Commands.UpdateGameLineup;

using MediatR;
using Roster.Application.Commands.AssignInningFielding;

public record UpdateGameLineupCommand(
    Guid TeamId,
    Guid GameId,
    IReadOnlyList<Guid> BattingOrder,
    IReadOnlyDictionary<int, IReadOnlyList<FieldingAssignmentDto>> InningAssignments
) : IRequest;
