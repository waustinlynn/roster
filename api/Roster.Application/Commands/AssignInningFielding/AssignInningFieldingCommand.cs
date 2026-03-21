namespace Roster.Application.Commands.AssignInningFielding;
using MediatR;

public record AssignInningFieldingCommand(
    Guid TeamId,
    Guid GameId,
    int InningNumber,
    IReadOnlyList<FieldingAssignmentDto> Assignments) : IRequest;

public record FieldingAssignmentDto(Guid PlayerId, string Position);
