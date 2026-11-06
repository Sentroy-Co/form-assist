using System.Diagnostics;
using System.Text.Json.Nodes;

var cli = args.Length > 0 ? args[0] : "../../packages/form-assist/dist/cli/index.js";
var request = JsonNode.Parse(await File.ReadAllTextAsync("../../fixtures/cli/request.json"))!;
var expected = JsonNode.Parse(await File.ReadAllTextAsync("../../fixtures/cli/response.json"))!;
var start = new ProcessStartInfo("node") { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
foreach (var arg in new[] { cli, "propose", "--fixture", "demo", "--connection", "demo", "--model", "demo", "--stdin", "--json" }) start.ArgumentList.Add(arg);
using var process = Process.Start(start) ?? throw new Exception("Could not start CLI");
var stdout = process.StandardOutput.ReadToEndAsync();
var stderr = process.StandardError.ReadToEndAsync();
using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
try {
    await process.StandardInput.WriteAsync(request.ToJsonString().AsMemory(), timeout.Token);
    process.StandardInput.Close();
    await process.WaitForExitAsync(timeout.Token);
} catch { if (!process.HasExited) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); } throw; }
var output = await stdout; var errors = await stderr;
if (process.ExitCode != 0) throw new Exception($"CLI failed: {errors}");
var actual = JsonNode.Parse(output);
if (!JsonNode.DeepEquals(expected, actual)) throw new Exception("Fixture mismatch");
Console.WriteLine(output);
