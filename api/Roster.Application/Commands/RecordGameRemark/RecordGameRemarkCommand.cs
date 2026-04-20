namespace Roster.Application.Commands.RecordGameRemark;

using MediatR;

public record RecordGameRemarkCommand(
    Guid TeamId,
    Guid GameId,
    string Remark) : IRequest;
