import { useState, useEffect } from "react";
import { getData, postData } from "../api/apiService"; // Asegúrate de que esta importación es correcta
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import WeeklyHistory from "./WeeklyHistory";

const COLORS = ["#8b5cf6", "#a78bfa", "#c4b5fd"];

export default function WeeklyEvaluation({ groupId }) {
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [template, setTemplate] = useState(null);
  const [taskEvaluations, setTaskEvaluations] = useState({});
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reload, setReload] = useState(false); // Nuevo estado para forzar la recarga
  const { toast } = useToast();

  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const response = await getData(`/sprints?group_id=${groupId}`);
        setSprints(response || []);
      } catch (err) {
        console.error("Error al obtener los sprints:", err);
      }
    };
    fetchSprints();
  }, [groupId]);

  useEffect(() => {
    if (selectedSprintId) {
      const fetchEvaluationTemplate = async (sprintId) => {
        try {
          const response = await getData(`/sprints/${sprintId}/weekly-evaluation-template`);
          if (response.success) {
            const fetchedTemplate = response.data.template;
            setTemplate(fetchedTemplate);

            if (fetchedTemplate.tasks.length === 0) {
              setIsEvaluated(true);
            } else {
              setIsEvaluated(false);
            }
          }
        } catch (error) {
          console.error("Error al cargar la plantilla:", error);
        }
      };
      fetchEvaluationTemplate(selectedSprintId);
    }
  }, [selectedSprintId, reload]); // Dependemos también de reload


  const handleSatisfactionChange = (taskId, value) => {
    setTaskEvaluations(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], satisfaction_level: value }
    }));
  };

  const handleCommentChange = (taskId, value) => {
    if (value.length <= 200) {
      setTaskEvaluations(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], comments: value }
      }));
    }
  };

  const handleSaveEvaluation = async () => {
    const totalTasks = template.tasks.length;
    const completedEvaluations = Object.values(taskEvaluations).filter(
        (evaluation) => evaluation.satisfaction_level && evaluation.comments
    ).length;

    if (completedEvaluations !== totalTasks) {
      toast({
        title: "Error",
        description: `Debe completar la evaluación de todas las tareas (${completedEvaluations}/${totalTasks}).`,
        status: "error",
        variant: "destructive",
      });
      return;
    }

    // Estructura correcta de `postData` para el endpoint
    const tasksData = Object.entries(taskEvaluations).map(([taskId, { comments, satisfaction_level }]) => ({
      id: Number(taskId),
      comments,
      satisfaction_level,
    }));

    const postDataPayload = {
      tasks: tasksData,
    };

    try {
      await postData(`/sprints/${selectedSprintId}/weekly-evaluation`, postDataPayload);
      toast({
        title: "Éxito",
        description: "Evaluación guardada con éxito.",
        className: "bg-green-500 text-white",
      });
      setReload((prev) => !prev);
    } catch (error) {
      console.error("Error al guardar evaluación:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al guardar la evaluación, revise de nuevo el formulario.",
        variant: "destructive",
      });
    }
  };

  const groupedMembers = template
      ? template.tasks.reduce((acc, task) => {
        task.assigned_to.forEach((member) => {
          const existingMember = acc.find((m) => m.id === member.id);
          if (existingMember) {
            existingMember.hecho += 1;
          } else {
            acc.push({
              ...member,
              porHacer: 0,
              enProgreso: 0,
              hecho: 1,
            });
          }
        });
        return acc;
      }, [])
      : [];

  const totalTasks = groupedMembers.reduce((acc, member) => acc + member.hecho, 0);

  const taskData = groupedMembers.map((member) => ({
    name: `${member.name} ${member.last_name}`,
    value: member.hecho,
  }));

  return (
      <div className="p-4 mx-auto space-y-6 max-w-full">
        <h1 className="text-2xl font-bold text-center mb-4 text-purple-600">Evaluación Semanal</h1>

        <div>
          <h2 className="text-purple-600 mb-2">Seleccionar Sprint</h2>
          <select
              className="p-2 border border-gray-300 rounded-md shadow-sm w-full"
              value={selectedSprintId || ""}
              onChange={(e) => setSelectedSprintId(e.target.value)}
          >
            <option value="">Seleccionar Sprint</option>
            {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.title}</option>
            ))}
          </select>
        </div>

        {template && (
            <>
              {isEvaluated ? (
                  <div className="flex flex-col items-center justify-center p-4 bg-green-100 border border-green-400 rounded-md shadow-md">
                    <svg
                        className="w-16 h-16 text-green-500 mb-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4M12 3C7.031 3 3 7.03 3 12s4.031 9 9 9 9-4.03 9-9-4.031-9-9-9z"
                      />
                    </svg>
                    <h2 className="text-lg font-semibold text-green-700">
                      ¡Evaluación completada!
                    </h2>
                    <p className="text-green-600">
                      Esta semana ya ha sido evaluada. No es necesario realizar otra evaluación.
                    </p>
                    <button
                        className={`mt-4 px-4 py-2 rounded-md shadow font-bold text-white ${
                            showReport ? "bg-purple-600 hover:bg-purple-700" : "bg-green-500 hover:bg-green-600"
                        }`}
                        onClick={() => setShowReport(!showReport)}
                    >
                      {showReport ? "Ocultar Historial" : "Ver Historial"}
                    </button>
                  </div>
              ) : (
                  // Mostrar el resto del contenido si no ha sido evaluada
                  <>
                    <h2 className="text-xl font-semibold mb-4">Reporte semanal - Semana {template.week_number}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                      <div>
                        <h2 className="text-purple-600">Requerimientos</h2>
                        <ul className="list-disc list-inside space-y-2">
                          {template.features.split("\n").map((feature, index) => (
                              <li key={index}>{feature}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h2 className="font-semibold mb-4">Estado de Participación</h2>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                                data={taskData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                            >
                              {taskData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {taskData.map((item, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  ></div>
                                  <span>{item.name}</span>
                                </div>
                                <div className="flex gap-4">
                                  <span>{item.value} tareas</span>
                                  <span>({((item.value / totalTasks) * 100).toFixed(1)}%)</span>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mt-6">
                      <h2 className="text-purple-600 mb-4">Tareas Completadas</h2>
                      {template.tasks.map(task => (
                          <div key={task.id} className="bg-white p-4 rounded-lg shadow-md">
                            <h3 className="font-bold text-purple-600">{task.title}</h3>
                            <p className="text-gray-600">{task.description}</p>
                            <p className="text-sm text-gray-500">Encargado(s): {task.assigned_to.map(member => `${member.name} ${member.last_name}`).join(", ")}</p>
                            {task.links.length > 0 && (
                                <div className="mt-2">
                                  <h4 className="text-purple-500 font-semibold">Links:</h4>
                                  <ul>
                                    {task.links.map(link => (
                                        <li key={link.id}>
                                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                            {link.description}
                                          </a>
                                        </li>
                                    ))}
                                  </ul>
                                </div>
                            )}
                            <div className="mt-2">
                              <label className="mr-2">Satisfacción:</label>
                              <select
                                  value={taskEvaluations[task.id]?.satisfaction_level || ""}
                                  onChange={(e) => handleSatisfactionChange(task.id, Number(e.target.value))}
                                  className="border p-1 rounded"
                                  required
                              >
                                <option value="">Seleccionar</option>
                                <option value={5}>Excelente</option>
                                <option value={4}>Bueno</option>
                                <option value={3}>Aceptable</option>
                                <option value={2}>Regular</option>
                                <option value={1}>Malo</option>
                              </select>
                            </div>
                            <div className="mt-2">
                              <label>Comentarios:</label>
                              <textarea
                                  value={taskEvaluations[task.id]?.comments || ""}
                                  onChange={(e) => handleCommentChange(task.id, e.target.value)}
                                  className="w-full p-2 border rounded-md mt-1"
                                  maxLength="200"
                                  required
                              />
                            </div>
                          </div>
                      ))}
                    </div>

                    <div className="space-y-4 mt-6">
                      <button onClick={handleSaveEvaluation} className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md">
                        Guardar evaluación
                      </button>
                    </div>
                  </>
              )}
            </>
        )}
        {showReport && (
            <WeeklyHistory sprintId={selectedSprintId} />
        )}
      </div>
  );

}