namespace Roster.Application.Commands.RatePlayerSkill;
using MediatR;
public record RatePlayerSkillCommand(Guid TeamId, Guid PlayerId, string SkillName, int Rating) : IRequest;
