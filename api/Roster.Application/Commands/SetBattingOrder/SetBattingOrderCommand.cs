namespace Roster.Application.Commands.SetBattingOrder;
using MediatR;
public record SetBattingOrderCommand(Guid TeamId, Guid GameId, IReadOnlyList<Guid> OrderedPlayerIds) : IRequest;
