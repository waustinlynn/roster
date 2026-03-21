namespace Roster.Application.Commands.MarkPlayerAbsent;
using MediatR;
public record MarkPlayerAbsentCommand(Guid TeamId, Guid GameId, Guid PlayerId) : IRequest;
