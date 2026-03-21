namespace Roster.Api.Controllers;

using Microsoft.AspNetCore.Mvc;

[ApiController]
public abstract class BaseController : ControllerBase
{
    protected Guid ResolvedTeamId =>
        HttpContext.Items.TryGetValue("TeamId", out var teamId) && teamId is Guid id
            ? id
            : throw new InvalidOperationException("TeamId not resolved by middleware.");
}
