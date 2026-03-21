namespace Roster.Application.Commands.RevokePlayerAbsence;
using MediatR;
public record RevokePlayerAbsenceCommand(Guid TeamId, Guid GameId, Guid PlayerId) : IRequest;
